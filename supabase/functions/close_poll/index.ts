// close_poll — runs every 15 min via pg_cron; for each flat whose
// poll_close_time falls in this window and has an 'open' poll today,
// computes the winner and closes it. Winner logic lives in
// select-winner.ts.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';
import { selectWinner, type VoteTally } from './select-winner.ts';

Deno.serve(async (_req) => {
  const admin = createAdminClient();
  const nowIst = nowInIst();

  const { data: flats, error: flatsError } = await admin
    .from('flats')
    .select('id, poll_close_time');

  if (flatsError) {
    await logPipelineError(admin, 'close_poll', { message: flatsError.message });
    return new Response(JSON.stringify({ error: flatsError.message }), { status: 500 });
  }

  const dueFlats = (flats ?? []).filter((flat) => isWithinCronWindow(flat.poll_close_time, nowIst));

  const results = await Promise.allSettled(dueFlats.map((flat) => closePollForFlat(admin, flat.id)));

  const failures = results.filter((r) => r.status === 'rejected').length;
  return new Response(JSON.stringify({ processed: dueFlats.length, failures }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function closePollForFlat(admin: ReturnType<typeof createAdminClient>, flatId: string) {
  try {
    const { data: poll, error: pollError } = await admin
      .from('daily_polls')
      .select('id, poll_date, status')
      .eq('flat_id', flatId)
      .eq('status', 'open')
      .order('poll_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError) throw pollError;
    if (!poll) return; // nothing open for this flat right now (idempotent)

    const [{ data: memberRows }, { data: attendanceRows }] = await Promise.all([
      admin.from('flat_members').select('user_id').eq('flat_id', flatId),
      admin
        .from('day_attendance')
        .select('user_id, is_out')
        .eq('flat_id', flatId)
        .eq('poll_date', poll.poll_date),
    ]);

    const memberCount = (memberRows ?? []).length;
    const outCount = (attendanceRows ?? []).filter((a) => a.is_out).length;

    if (memberCount > 0 && outCount >= memberCount) {
      await admin.from('daily_polls').update({ status: 'cancelled' }).eq('id', poll.id);
      return;
    }

    const { data: optionRows, error: optionsError } = await admin
      .from('poll_options')
      .select('recipe_id')
      .eq('poll_id', poll.id);
    if (optionsError) throw optionsError;

    const { data: voteRows, error: votesError } = await admin
      .from('votes')
      .select('recipe_id')
      .eq('poll_id', poll.id);
    if (votesError) throw votesError;

    const voteCounts = new Map<string, number>();
    for (const vote of voteRows ?? []) {
      voteCounts.set(vote.recipe_id, (voteCounts.get(vote.recipe_id) ?? 0) + 1);
    }
    const tallies: VoteTally[] = (optionRows ?? []).map((o) => ({
      recipeId: o.recipe_id,
      voteCount: voteCounts.get(o.recipe_id) ?? 0,
    }));

    const { data: history, error: historyError } = await admin
      .from('daily_polls')
      .select('poll_date, winner_recipe_id')
      .eq('flat_id', flatId)
      .eq('status', 'dispatched')
      .not('winner_recipe_id', 'is', null)
      .order('poll_date', { ascending: false });
    if (historyError) throw historyError;

    const lastServedAt = new Map<string, string | undefined>();
    for (const row of history ?? []) {
      if (row.winner_recipe_id && !lastServedAt.has(row.winner_recipe_id)) {
        lastServedAt.set(row.winner_recipe_id, row.poll_date);
      }
    }

    const winner = selectWinner(tallies, lastServedAt);
    if (!winner) {
      await logPipelineError(admin, 'close_poll', { message: 'poll has no options to pick a winner from' }, flatId);
      return;
    }

    await admin
      .from('daily_polls')
      .update({ status: 'closed', winner_recipe_id: winner.recipeId, winner_reason: winner.reason })
      .eq('id', poll.id);

    // TODO: push notification announcing the winner to flat members.
  } catch (err) {
    await logPipelineError(
      admin,
      'close_poll',
      { message: err instanceof Error ? err.message : String(err) },
      flatId
    );
  }
}
