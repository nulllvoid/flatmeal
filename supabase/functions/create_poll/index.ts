// create_poll — runs every 15 min via pg_cron; for each flat whose
// poll_open_time falls in this window, generates today's 3-option poll.
//
// Selection rules (docs/02-prd.md §F2, docs/03-mvp-spec.md "Daily pipeline"):
//   1. Hard filter: union of flat members' diet_type/is_jain/allergies as an
//      unoverrideable veto against recipes.diet_class/jain_ok/allergens.
//   2. Exclude any recipe served to this flat (dispatched poll) in the last
//      10 days.
//   3. Variety heuristic: not all 3 options share the same cuisine or base.
//   4. Deterministic + idempotent: selection is seeded by (flat_id, date);
//      insert upserts on daily_polls(flat_id, poll_date) unique constraint.
//
// TODO: implement selection query + seeded shuffle; this stub only lays out
// the control flow and idempotency/error-logging contract.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { istDateString, isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';

Deno.serve(async (_req) => {
  const admin = createAdminClient();
  const nowIst = nowInIst();
  const pollDate = istDateString(nowIst);

  const { data: flats, error: flatsError } = await admin
    .from('flats')
    .select('id, poll_open_time');

  if (flatsError) {
    await logPipelineError(admin, 'create_poll', { message: flatsError.message });
    return new Response(JSON.stringify({ error: flatsError.message }), { status: 500 });
  }

  const dueFlats = (flats ?? []).filter((flat) => isWithinCronWindow(flat.poll_open_time, nowIst));

  const results = await Promise.allSettled(
    dueFlats.map((flat) => createPollForFlat(admin, flat.id, pollDate))
  );

  const failures = results.filter((r) => r.status === 'rejected').length;
  return new Response(JSON.stringify({ processed: dueFlats.length, failures }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function createPollForFlat(
  admin: ReturnType<typeof createAdminClient>,
  flatId: string,
  pollDate: string
) {
  try {
    // Idempotent: unique (flat_id, poll_date) means a re-run is a no-op.
    const { data: existing } = await admin
      .from('daily_polls')
      .select('id')
      .eq('flat_id', flatId)
      .eq('poll_date', pollDate)
      .maybeSingle();

    if (existing) return;

    // TODO: query flat_members + profiles for dietary union, query recipes
    // filtered by that union minus allergens, minus last-10-days-served
    // (derived from daily_polls where status='dispatched'), then pick 3
    // with the variety heuristic using a (flat_id, poll_date) seeded RNG.
    const selectedRecipeIds: string[] = [];

    const { data: poll, error: pollError } = await admin
      .from('daily_polls')
      .insert({ flat_id: flatId, poll_date: pollDate, status: 'open' })
      .select('id')
      .single();

    if (pollError) throw pollError;

    if (selectedRecipeIds.length > 0) {
      await admin.from('poll_options').insert(
        selectedRecipeIds.map((recipeId, index) => ({
          poll_id: poll.id,
          recipe_id: recipeId,
          position: index + 1,
        }))
      );
    }

    // TODO: push notification "Vote for tonight's dinner" to flat members.
  } catch (err) {
    await logPipelineError(
      admin,
      'create_poll',
      { message: err instanceof Error ? err.message : String(err) },
      flatId
    );
  }
}
