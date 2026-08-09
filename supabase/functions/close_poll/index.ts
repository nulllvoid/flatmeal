// close_poll — runs every 15 min via pg_cron; for each flat whose
// poll_close_time falls in this window and has an 'open' poll today, locks
// the cart. There is no winner to compute anymore: mains and accompaniments
// are both just cart_items lines the flat built together during the open
// window. Locking is enforced at the RLS layer (cart_items writes require
// daily_polls.status = 'open') — the cart_items rows in place at this moment
// ARE the snapshot, no copy needed.

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

    await admin.from('daily_polls').update({ status: 'closed' }).eq('id', poll.id);

    // TODO: push notification announcing tonight's locked cart to flat members.
  } catch (err) {
    await logPipelineError(
      admin,
      'close_poll',
      { message: err instanceof Error ? err.message : String(err) },
      flatId
    );
  }
}
