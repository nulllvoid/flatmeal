// dispatch_cook — runs every 15 min via pg_cron; for each flat whose
// dispatch_time falls in this window and has a 'closed' poll today,
// composes and sends the cook's WhatsApp message.
//
// Pipeline (docs/06-whatsapp-integration.md "Composition pipeline",
// docs/04-architecture.md "Sequence: dispatch_cook"):
//   1. Load the locked cart (cart_items) — every line is a dish + its own
//      quantity, decided together by the flat. Recompute headcount from
//      day_attendance (out-toggles count as of now) — informational only
//      now, no longer an ingredient-scaling multiplier.
//   2. Scale EACH dish's recipe_ingredients by ITS OWN cart line quantity,
//      not by flat headcount.
//   3. Compose English payload (per-dish sections, flat_note).
//   4. Translation: read recipe_translations(recipe_id, cook.language) if
//      present; else call Google Translate and insert with
//      reviewed_at = null (flagged for human review), once per dish. flat_note
//      is always live-translated (short, dynamic, never cached). If no
//      translation is cached AND GOOGLE_TRANSLATE_API_KEY is unset, falls
//      back to the English payload rather than blocking dispatch.
//   5. Fill WhatsApp template variables, call BSP send API — unless
//      DISPATCH_MODE=mock, which skips the network call and logs
//      status='mocked' instead. This must work end-to-end before Meta
//      template approval lands. Live BSP send is not implemented (no BSP
//      account provisioned yet) — mode='live' logs status='failed'.
//   6. Insert dispatch_log row; wa_webhook updates status afterwards.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';
import {
  composeEnglishPayload,
  composeIngredientLine,
  composeMethodLine,
  type DishLine,
  type RecipeIngredientRow,
} from './compose-payload.ts';
import { translateText } from './translate.ts';

type DispatchMode = 'mock' | 'live';

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
      .select('id, poll_date, flat_note')
      .eq('flat_id', flatId)
      .eq('status', 'closed')
      .order('poll_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pollError) throw pollError;
    if (!poll) return; // nothing to dispatch (idempotent)

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

    const { data: cartRows, error: cartError } = await admin
      .from('cart_items')
      .select('recipe_id, quantity, recipes(name, kind, instructions_en)')
      .eq('poll_id', poll.id);
    if (cartError) throw cartError;

    if (!cartRows || cartRows.length === 0) {
      await logPipelineError(admin, 'dispatch_cook', { message: 'empty cart at dispatch time' }, flatId);
      return;
    }

    // Mains first, then accompaniments, then sides, mirroring the "list
    // dishes with their own headcounts" composition order (docs/06 decision
    // #6). All three kinds must be included here — a cart line whose
    // recipe.kind isn't explicitly bucketed would silently vanish from the
    // cook's message despite being in the customer-facing cart.
    const mains = cartRows.filter((r) => r.recipes?.kind === 'main');
    const accompaniments = cartRows.filter((r) => r.recipes?.kind === 'accompaniment');
    const sides = cartRows.filter((r) => r.recipes?.kind === 'side');
    const orderedCartRows = [...mains, ...accompaniments, ...sides];
    const cartRecipeIds = orderedCartRows.map((r) => r.recipe_id);

    const [{ data: memberRows }, { data: attendanceRows }, { data: allIngredientRows }] = await Promise.all([
      admin.from('flat_members').select('user_id').eq('flat_id', flatId),
      admin
        .from('day_attendance')
        .select('user_id, is_out')
        .eq('flat_id', flatId)
        .eq('poll_date', poll.poll_date),
      admin
        .from('recipe_ingredients')
        .select('recipe_id, name_en, name_hi, name_kn, qty_per_person, unit, is_staple, sort_order')
        .in('recipe_id', cartRecipeIds)
        .order('sort_order'),
    ]);

    // Informational only now (dispatch_log metadata + preview text) — no
    // longer an ingredient-scaling multiplier. Each dish scales by its own
    // cart line quantity instead (decision #6's key architectural inversion).
    const outUserIds = new Set((attendanceRows ?? []).filter((a) => a.is_out).map((a) => a.user_id));
    const headcount = Math.max((memberRows ?? []).length - outUserIds.size, 0);

    const ingredientsByRecipe = new Map<string, RecipeIngredientRow[]>();
    for (const row of allIngredientRows ?? []) {
      const list = ingredientsByRecipe.get(row.recipe_id) ?? [];
      list.push(row);
      ingredientsByRecipe.set(row.recipe_id, list);
    }

    const dishes: DishLine[] = orderedCartRows.map((row) => ({
      recipeId: row.recipe_id,
      name: row.recipes?.name ?? 'dish',
      quantity: row.quantity,
      instructions: row.recipes?.instructions_en ?? '',
      ingredients: ingredientsByRecipe.get(row.recipe_id) ?? [],
    }));

    // Step 3: English payload (per-dish sections + flat note) — this is the
    // in-app preview shape, not constrained by the WhatsApp template's slots.
    const payloadEn = composeEnglishPayload({ dishes, flatNote: poll.flat_note });

    // Step 4: translation — cached recipe_translations first; else live
    // Google Translate (flagged reviewed_at=null) if a key is configured;
    // else fall back to English so dispatch is never blocked on it.
    const payloadTranslated = await composeTranslatedPayload(admin, {
      dishes,
      headcount,
      language: cook.language as 'hi' | 'kn' | 'en',
      flatNote: poll.flat_note,
      fallback: payloadEn,
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
// off — docs/06 "Quality gate before pilot"). Called once per dish in the cart.
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

// Fills the approved 6-slot WhatsApp template (docs/06-whatsapp-integration.md):
// {{1}} cook name (filled by the caller/BSP layer, not here), {{2}} dish
// name, {{3}} total headcount, {{4}} per-dish ingredient breakdown, {{5}}
// per-dish method breakdown, {{6}} flat note. The template's surrounding
// text is fixed and approved, so per-dish detail is pushed into the two
// free-text slots ({{4}}/{{5}}) rather than reshaping {{3}}.
async function composeTranslatedPayload(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    dishes: DishLine[];
    headcount: number;
    language: 'hi' | 'kn' | 'en';
    flatNote: string | null;
    fallback: string;
  }
): Promise<string> {
  const { dishes, headcount, language, flatNote, fallback } = params;

  if (language === 'en') return fallback;

  const ingredientLine = composeIngredientLine(dishes, language);

  const translatedInstructions = new Map<string, string>();
  for (const dish of dishes) {
    const translated = await getOrTranslateInstructions(admin, dish.recipeId, language, dish.instructions);
    if (!translated) {
      // No cache and no translate key configured — dispatch must not block
      // on this, so the cook gets the English payload instead of nothing.
      return fallback;
    }
    translatedInstructions.set(dish.recipeId, translated);
  }

  const methodLine = composeMethodLine(dishes, translatedInstructions);
  const translatedNote = flatNote && flatNote.trim() ? await translateText(flatNote, language) : null;

  const dishSummary = dishes.map((d) => d.name).join(', ');

  return [
    `Today's meal: ${dishSummary}`,
    `Please cook for ${headcount} people.`,
    '',
    `Ingredients: ${ingredientLine}`,
    '',
    `Method:\n${methodLine}`,
    '',
    `Note: ${translatedNote ?? flatNote ?? '—'}`,
  ].join('\n');
}
