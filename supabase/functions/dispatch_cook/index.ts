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
import { composeEnglishPayload, composeIngredientLine, type RecipeIngredientRow } from './compose-payload.ts';
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
      .select('id, poll_date, winner_recipe_id, flat_note')
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

    // Step 1: recompute headcount as of now, not as of poll close.
    const [{ data: memberRows }, { data: attendanceRows }, { data: recipe }, { data: ingredientRows }] =
      await Promise.all([
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
      ]);

    const outUserIds = new Set((attendanceRows ?? []).filter((a) => a.is_out).map((a) => a.user_id));
    const headcount = Math.max((memberRows ?? []).length - outUserIds.size, 0);
    const ingredients: RecipeIngredientRow[] = ingredientRows ?? [];

    // Step 3: English payload (dish, headcount, ingredients, method, note).
    const payloadEn = composeEnglishPayload({
      dishName: recipe?.name ?? 'tonight\'s dinner',
      headcount,
      ingredients,
      instructions: recipe?.instructions_en ?? '',
      flatNote: poll.flat_note,
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
// off — docs/06 "Quality gate before pilot"). flat_note is short and
// dynamic so it's translated live every time, never cached. English cook
// language skips translation entirely.
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
  }
): Promise<string> {
  const { recipeId, language, dishName, headcount, ingredients, englishInstructions, flatNote, fallback } = params;

  if (language === 'en') return fallback;

  const ingredientLine = composeIngredientLine(ingredients, headcount, language);

  const { data: cached } = await admin
    .from('recipe_translations')
    .select('instructions')
    .eq('recipe_id', recipeId)
    .eq('language', language)
    .maybeSingle();

  let instructions = cached?.instructions ?? null;

  if (!instructions) {
    instructions = await translateText(englishInstructions, language);
    if (instructions) {
      // Cached with reviewed_at left null — flags it for the pre-pilot
      // native-speaker review pass, never presented as pre-reviewed.
      await admin
        .from('recipe_translations')
        .insert({ recipe_id: recipeId, language, instructions, reviewed_at: null })
        .select('recipe_id')
        .maybeSingle();
    }
  }

  if (!instructions) {
    // No cache and no translate key configured — dispatch must not block on
    // this, so the cook gets the English payload instead of nothing.
    return fallback;
  }

  const translatedNote = flatNote && flatNote.trim() ? await translateText(flatNote, language) : null;

  return [
    `Today's meal: ${dishName}`,
    `Please cook for ${headcount} people.`,
    '',
    `Ingredients: ${ingredientLine}`,
    '',
    `Method:\n${instructions}`,
    '',
    `Note: ${translatedNote ?? flatNote ?? '—'}`,
  ].join('\n');
}
