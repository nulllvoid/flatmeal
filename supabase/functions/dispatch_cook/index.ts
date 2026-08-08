// dispatch_cook — runs every 15 min via pg_cron; for each flat whose
// dispatch_time falls in this window and has a 'closed' poll today,
// composes and sends the cook's WhatsApp message.
//
// Pipeline (docs/06-whatsapp-integration.md "Composition pipeline",
// docs/04-architecture.md "Sequence: dispatch_cook"):
//   1. Recompute headcount from day_attendance (out-toggles count as of now,
//      not as of poll close).
//   2. Scale recipe_ingredients qty_per_person × headcount, round to
//      buyable units.
//   3. Compose English payload (dish, headcount, ingredients, instructions,
//      flat_note).
//   4. Translation: read recipe_translations(recipe_id, cook.language) if
//      present; else call Google Translate and insert with
//      reviewed_at = null (flagged for human review). flat_note is always
//      live-translated (short, dynamic, never cached). If no translation is
//      cached AND GOOGLE_TRANSLATE_API_KEY is unset, falls back to the
//      English payload rather than blocking dispatch.
//   5. Fill WhatsApp template variables, call BSP send API — unless
//      DISPATCH_MODE=mock, which skips the network call and logs
//      status='mocked' instead. This must work end-to-end before Meta
//      template approval lands. Live BSP send is not implemented (no BSP
//      account provisioned yet) — mode='live' logs status='failed'.
//   6. Insert dispatch_log row; wa_webhook updates status afterwards.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';
import { selectWinner, type VoteTally } from '../_shared/select-winner.ts';
import { composeEnglishPayload, composeIngredientLine, type RecipeIngredientRow } from './compose-payload.ts';
import { translateText } from './translate.ts';

type DispatchMode = 'mock' | 'live';
type AccompanimentWinnerReason = 'votes' | 'tiebreak_lru' | 'auto_no_votes' | 'none_available';

Deno.serve(async (_req) => {
  const admin = createAdminClient();
  const nowIst = nowInIst();
  const dispatchMode = (Deno.env.get('DISPATCH_MODE') as DispatchMode) ?? 'mock';

  const { data: flats, error: flatsError } = await admin
    .from('flats')
    .select('id, dispatch_time');

  if (flatsError) {
    await logPipelineError(admin, 'dispatch_cook', { message: flatsError.message });
    return new Response(JSON.stringify({ error: flatsError.message }), { status: 500 });
  }

  const dueFlats = (flats ?? []).filter((flat) => isWithinCronWindow(flat.dispatch_time, nowIst));

  const results = await Promise.allSettled(
    dueFlats.map((flat) => dispatchForFlat(admin, flat.id, dispatchMode))
  );

  const failures = results.filter((r) => r.status === 'rejected').length;
  return new Response(
    JSON.stringify({ processed: dueFlats.length, failures, mode: dispatchMode }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

async function dispatchForFlat(
  admin: ReturnType<typeof createAdminClient>,
  flatId: string,
  mode: DispatchMode
) {
  try {
    const { data: poll, error: pollError } = await admin
      .from('daily_polls')
      .select(
        'id, poll_date, winner_recipe_id, flat_note, winner_accompaniment_recipe_id, winner_accompaniment_reason'
      )
      .eq('flat_id', flatId)
      .eq('status', 'closed')
      .order('poll_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError) throw pollError;
    if (!poll || !poll.winner_recipe_id) return; // nothing to dispatch (idempotent)

    const { data: cook } = await admin
      .from('cooks')
      .select('name, phone, language')
      .eq('flat_id', flatId)
      .eq('is_active', true)
      .maybeSingle();

    if (!cook) {
      await logPipelineError(admin, 'dispatch_cook', { message: 'no active cook for flat' }, flatId);
      return;
    }

    // Accompaniment vote tally — this is the "close" step for the second
    // vote, deliberately deferred to dispatch time since its candidates
    // (poll_accompaniment_options) aren't known until close_poll picks the
    // main winner. See docs/05-schema.sql's daily_polls.winner_accompaniment_*
    // comment. Runs before the ingredient fetch so accompanimentRecipeId is
    // available there.
    const { accompanimentRecipeId } = await resolveAccompanimentWinner(admin, poll, flatId);

    // Step 1: recompute headcount as of now, not as of poll close.
    const [
      { data: memberRows },
      { data: attendanceRows },
      { data: recipe },
      { data: ingredientRows },
      { data: accompanimentRecipe },
      { data: accompanimentIngredientRows },
    ] = await Promise.all([
      admin.from('flat_members').select('user_id').eq('flat_id', flatId),
      admin
        .from('day_attendance')
        .select('user_id, is_out')
        .eq('flat_id', flatId)
        .eq('poll_date', poll.poll_date),
      admin.from('recipes').select('name, instructions_en').eq('id', poll.winner_recipe_id).single(),
      admin
        .from('recipe_ingredients')
        .select('name_en, name_hi, name_kn, qty_per_person, unit, is_staple, sort_order')
        .eq('recipe_id', poll.winner_recipe_id)
        .order('sort_order'),
      accompanimentRecipeId
        ? admin.from('recipes').select('name, instructions_en').eq('id', accompanimentRecipeId).maybeSingle()
        : Promise.resolve({ data: null }),
      accompanimentRecipeId
        ? admin
            .from('recipe_ingredients')
            .select('name_en, name_hi, name_kn, qty_per_person, unit, is_staple, sort_order')
            .eq('recipe_id', accompanimentRecipeId)
            .order('sort_order')
        : Promise.resolve({ data: null }),
    ]);

    const outUserIds = new Set((attendanceRows ?? []).filter((a) => a.is_out).map((a) => a.user_id));
    const headcount = Math.max((memberRows ?? []).length - outUserIds.size, 0);
    // Accompaniment items visually trail the main dish's in the flat
    // ingredient list (cosmetic sort_order offset — the WhatsApp message is
    // a flat comma-separated list either way, not grouped by dish).
    const ingredients: RecipeIngredientRow[] = [
      ...(ingredientRows ?? []),
      ...(accompanimentIngredientRows ?? []).map((r) => ({ ...r, sort_order: r.sort_order + 100 })),
    ];

    // Step 3: English payload (dish, headcount, ingredients, method, note).
    const payloadEn = composeEnglishPayload({
      dishName: recipe?.name ?? 'tonight\'s dinner',
      headcount,
      ingredients,
      instructions: recipe?.instructions_en ?? '',
      flatNote: poll.flat_note,
      accompanimentName: accompanimentRecipe?.name ?? null,
      accompanimentInstructions: accompanimentRecipe?.instructions_en ?? null,
    });

    // Step 4: translation — cached recipe_translations first; else live
    // Google Translate (flagged reviewed_at=null) if a key is configured;
    // else fall back to English so dispatch is never blocked on it.
    const payloadTranslated = await composeTranslatedPayload(admin, {
      recipeId: poll.winner_recipe_id,
      language: cook.language as 'hi' | 'kn' | 'en',
      dishName: recipe?.name ?? 'tonight\'s dinner',
      headcount,
      ingredients,
      englishInstructions: recipe?.instructions_en ?? '',
      flatNote: poll.flat_note,
      fallback: payloadEn,
      accompanimentRecipeId,
      accompanimentName: accompanimentRecipe?.name ?? null,
      accompanimentEnglishInstructions: accompanimentRecipe?.instructions_en ?? null,
    });

    let status: 'mocked' | 'sent' | 'failed' = 'mocked';
    let bspMessageId: string | null = null;
    let error: string | null = null;

    if (mode === 'live') {
      // No BSP account provisioned yet (docs/06-whatsapp-integration.md
      // "Setup" is a manual, day-1 prerequisite not yet done) — live send
      // cannot succeed until a BSP API key/account exists.
      status = 'failed';
      error = 'live dispatch not yet implemented — no BSP account configured';
    }

    await admin.from('dispatch_log').insert({
      poll_id: poll.id,
      mode,
      language: cook.language,
      headcount,
      payload_en: payloadEn,
      payload_translated: payloadTranslated,
      bsp_message_id: bspMessageId,
      status,
      error,
    });

    await admin.from('daily_polls').update({ status: 'dispatched' }).eq('id', poll.id);
  } catch (err) {
    await logPipelineError(
      admin,
      'dispatch_cook',
      { message: err instanceof Error ? err.message : String(err) },
      flatId
    );
  }
}

// Step 4: prefer the reviewed cache; otherwise machine-translate and cache
// it flagged for human review (reviewed_at stays null until someone signs
// off — docs/06 "Quality gate before pilot"). Shared by the main recipe and
// the accompaniment recipe (called once each).
async function getOrTranslateInstructions(
  admin: ReturnType<typeof createAdminClient>,
  recipeId: string,
  language: 'hi' | 'kn',
  englishInstructions: string
): Promise<string | null> {
  const { data: cached } = await admin
    .from('recipe_translations')
    .select('instructions')
    .eq('recipe_id', recipeId)
    .eq('language', language)
    .maybeSingle();

  if (cached?.instructions) return cached.instructions;

  const translated = await translateText(englishInstructions, language);
  if (translated) {
    // Cached with reviewed_at left null — flags it for the pre-pilot
    // native-speaker review pass, never presented as pre-reviewed.
    await admin
      .from('recipe_translations')
      .insert({ recipe_id: recipeId, language, instructions: translated, reviewed_at: null })
      .select('recipe_id')
      .maybeSingle();
  }
  return translated;
}

// flat_note is short and dynamic so it's translated live every time, never
// cached. English cook language skips translation entirely. Accompaniment
// dish *names* are never translated, matching the existing convention that
// main dish names aren't translated either (recipe_translations only caches
// `instructions`, not `name`).
async function composeTranslatedPayload(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    recipeId: string;
    language: 'hi' | 'kn' | 'en';
    dishName: string;
    headcount: number;
    ingredients: RecipeIngredientRow[];
    englishInstructions: string;
    flatNote: string | null;
    fallback: string;
    accompanimentRecipeId: string | null;
    accompanimentName: string | null;
    accompanimentEnglishInstructions: string | null;
  }
): Promise<string> {
  const {
    recipeId,
    language,
    dishName,
    headcount,
    ingredients,
    englishInstructions,
    flatNote,
    fallback,
    accompanimentRecipeId,
    accompanimentName,
    accompanimentEnglishInstructions,
  } = params;

  if (language === 'en') return fallback;

  const ingredientLine = composeIngredientLine(ingredients, headcount, language);

  const instructions = await getOrTranslateInstructions(admin, recipeId, language, englishInstructions);
  if (!instructions) {
    // No cache and no translate key configured — dispatch must not block on
    // this, so the cook gets the English payload instead of nothing.
    return fallback;
  }

  const accompanimentInstructions =
    accompanimentRecipeId && accompanimentEnglishInstructions
      ? await getOrTranslateInstructions(admin, accompanimentRecipeId, language, accompanimentEnglishInstructions)
      : null;

  const translatedNote = flatNote && flatNote.trim() ? await translateText(flatNote, language) : null;

  const dishLine = accompanimentName ? `${dishName} with ${accompanimentName}` : dishName;
  const methodSection = accompanimentInstructions
    ? `Method:\n${instructions}\n\nFor the ${accompanimentName}:\n${accompanimentInstructions}`
    : `Method:\n${instructions}`;

  return [
    `Today's meal: ${dishLine}`,
    `Please cook for ${headcount} people.`,
    '',
    `Ingredients: ${ingredientLine}`,
    '',
    methodSection,
    '',
    `Note: ${translatedNote ?? flatNote ?? '—'}`,
  ].join('\n');
}

// Tallies accompaniment_votes for the poll's poll_accompaniment_options (if
// any) and stamps the winner on daily_polls, mirroring close_poll's
// main-dish tally via the same shared selectWinner(). No-op (returns the
// already-stamped value) if a prior partial run already decided it, or if
// close_poll already stamped 'none_available'.
async function resolveAccompanimentWinner(
  admin: ReturnType<typeof createAdminClient>,
  poll: {
    id: string;
    winner_accompaniment_recipe_id: string | null;
    winner_accompaniment_reason: string | null;
  },
  flatId: string
): Promise<{ accompanimentRecipeId: string | null }> {
  if (poll.winner_accompaniment_recipe_id) {
    return { accompanimentRecipeId: poll.winner_accompaniment_recipe_id };
  }
  if (poll.winner_accompaniment_reason === 'none_available') {
    return { accompanimentRecipeId: null };
  }

  const { data: optionRows } = await admin
    .from('poll_accompaniment_options')
    .select('recipe_id')
    .eq('poll_id', poll.id);

  if (!optionRows || optionRows.length === 0) {
    // close_poll should have already stamped 'none_available' for this
    // case, but guard defensively rather than leaving the column null.
    await admin.from('daily_polls').update({ winner_accompaniment_reason: 'none_available' }).eq('id', poll.id);
    return { accompanimentRecipeId: null };
  }

  const { data: voteRows } = await admin.from('accompaniment_votes').select('recipe_id').eq('poll_id', poll.id);

  const voteCounts = new Map<string, number>();
  for (const vote of voteRows ?? []) {
    voteCounts.set(vote.recipe_id, (voteCounts.get(vote.recipe_id) ?? 0) + 1);
  }
  const tallies: VoteTally[] = optionRows.map((o) => ({
    recipeId: o.recipe_id,
    voteCount: voteCounts.get(o.recipe_id) ?? 0,
  }));

  const { data: history } = await admin
    .from('daily_polls')
    .select('poll_date, winner_accompaniment_recipe_id')
    .eq('flat_id', flatId)
    .eq('status', 'dispatched')
    .not('winner_accompaniment_recipe_id', 'is', null)
    .order('poll_date', { ascending: false });

  const lastServedAt = new Map<string, string | undefined>();
  for (const row of history ?? []) {
    if (row.winner_accompaniment_recipe_id && !lastServedAt.has(row.winner_accompaniment_recipe_id)) {
      lastServedAt.set(row.winner_accompaniment_recipe_id, row.poll_date);
    }
  }

  const winner = selectWinner(tallies, lastServedAt);
  const accompanimentRecipeId = winner?.recipeId ?? null;
  const accompanimentReason: AccompanimentWinnerReason = winner?.reason ?? 'auto_no_votes';

  await admin
    .from('daily_polls')
    .update({
      winner_accompaniment_recipe_id: accompanimentRecipeId,
      winner_accompaniment_reason: accompanimentReason,
    })
    .eq('id', poll.id);

  return { accompanimentRecipeId };
}
