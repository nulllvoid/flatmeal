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
//      live-translated (short, dynamic, never cached).
//   5. Fill WhatsApp template variables, call BSP send API — unless
//      DISPATCH_MODE=mock, which skips the network call and logs
//      status='mocked' instead. This must work end-to-end before Meta
//      template approval lands.
//   6. Insert dispatch_log row; wa_webhook updates status afterwards.
//
// TODO: implement steps 1-5; this stub lays out control flow, the mock/live
// branch, and idempotency (skip flats already dispatched today).

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { isWithinCronWindow, nowInIst } from '../_shared/ist-time.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';

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
      .select('id, winner_recipe_id, flat_note')
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

    // TODO: recompute headcount from day_attendance, scale
    // recipe_ingredients, compose English payload, resolve/create
    // recipe_translations, live-translate poll.flat_note.
    const headcount = 0;
    const payloadEn = '';
    const payloadTranslated = '';

    let status: 'mocked' | 'sent' | 'failed' = 'mocked';
    let bspMessageId: string | null = null;
    let error: string | null = null;

    if (mode === 'live') {
      // TODO: call BSP send API with filled template variables.
      status = 'failed';
      error = 'live dispatch not yet implemented';
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
