// create_poll — runs every 15 min via pg_cron; for each flat whose
// poll_open_time falls in this window, generates today's 3-option poll.
// Selection logic (dietary veto, 10-day exclusion, variety heuristic,
// seeded shuffle) lives in select-options.ts.

import { fetchMemberDietProfiles } from '../_shared/flat-members.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';
import { istDateString, isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';
import { selectPollOptions } from './select-options.ts';

const RECENT_DAYS_EXCLUSION = 10;

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

    const members = await fetchMemberDietProfiles(admin, flatId);

    if (members.length === 0) {
      await logPipelineError(admin, 'create_poll', { message: 'flat has no members' }, flatId);
      return;
    }

    const { data: recipes, error: recipesError } = await admin
      .from('recipes')
      .select('id, cuisine, base, diet_class, jain_ok, allergens')
      .eq('is_active', true);
    if (recipesError) throw recipesError;

    const cutoffDate = new Date(pollDate);
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - RECENT_DAYS_EXCLUSION);
    const { data: recentPolls, error: recentError } = await admin
      .from('daily_polls')
      .select('winner_recipe_id')
      .eq('flat_id', flatId)
      .eq('status', 'dispatched')
      .gte('poll_date', cutoffDate.toISOString().slice(0, 10))
      .not('winner_recipe_id', 'is', null);
    if (recentError) throw recentError;

    const recentlyServedRecipeIds = new Set(
      (recentPolls ?? []).map((p) => p.winner_recipe_id).filter((id): id is string => id !== null)
    );

    const selectedRecipeIds = selectPollOptions({
      flatId,
      pollDate,
      members: members.map((m) => ({
        diet_type: m.diet_type,
        is_jain: m.is_jain,
        allergies: m.allergies,
      })),
      eligibleRecipes: (recipes ?? []).map((r) => ({
        id: r.id,
        cuisine: r.cuisine,
        base: r.base,
        diet_class: r.diet_class,
        jain_ok: r.jain_ok,
        allergens: r.allergens,
      })),
      recentlyServedRecipeIds,
    });

    if (selectedRecipeIds.length === 0) {
      await logPipelineError(
        admin,
        'create_poll',
        { message: 'no eligible recipes for flat dietary constraints' },
        flatId
      );
      return;
    }

    const { data: poll, error: pollError } = await admin
      .from('daily_polls')
      .insert({ flat_id: flatId, poll_date: pollDate, status: 'open' })
      .select('id')
      .single();

    if (pollError) throw pollError;

    await admin.from('poll_options').insert(
      selectedRecipeIds.map((recipeId, index) => ({
        poll_id: poll.id,
        recipe_id: recipeId,
        position: index + 1,
      }))
    );

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
