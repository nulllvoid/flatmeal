// close_poll — runs every 15 min via pg_cron; for each flat whose
// poll_close_time falls in this window and has an 'open' poll today,
// computes the winner and closes it.
//
// Winner rules (docs/02-prd.md §F2):
//   - most votes wins
//   - tie, or zero votes → least-recently-eaten of the 3 options
//     (winner_reason: 'tiebreak_lru' or 'auto_no_votes')
//
// TODO: implement vote tally + LRU tie-break query against daily_polls
// history; this stub lays out control flow and idempotency.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';

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

    // TODO: check day_attendance — if all members are out, set status
    // 'cancelled' instead and skip winner computation entirely.

    // TODO: tally votes for poll.id; on tie or zero votes, pick
    // least-recently-eaten among poll_options via daily_polls history
    // (status='dispatched') for this flat_id.
    const winnerRecipeId: string | null = null;
    const winnerReason: 'votes' | 'tiebreak_lru' | 'auto_no_votes' = 'auto_no_votes';

    await admin
      .from('daily_polls')
      .update({ status: 'closed', winner_recipe_id: winnerRecipeId, winner_reason: winnerReason })
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
