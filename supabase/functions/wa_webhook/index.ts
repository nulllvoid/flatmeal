// wa_webhook — HTTP endpoint configured as the BSP's webhook URL
// (docs/06-whatsapp-integration.md step 4). Receives delivery-status
// callbacks (sent/delivered/read/failed) keyed by bsp_message_id and
// updates the matching dispatch_log row.
//
// TODO: verify the BSP's webhook signature/secret before trusting payloads.
// TODO: map the specific BSP's (AiSensy/Interakt) payload shape to our
// dispatch_log.status enum — the shape below is a placeholder guess.

import { createAdminClient } from '../_shared/supabase-admin.ts';
import { logPipelineError } from '../_shared/pipeline-errors.ts';

interface BspWebhookPayload {
  message_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
}

Deno.serve(async (req) => {
  const admin = createAdminClient();

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: BspWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { error } = await admin
    .from('dispatch_log')
    .update({ status: payload.status, error: payload.error ?? null, updated_at: new Date().toISOString() })
    .eq('bsp_message_id', payload.message_id);

  if (error) {
    await logPipelineError(admin, 'wa_webhook', { message: error.message, payload });
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // TODO: on status === 'failed', push a notification to flat members and
  // surface the wa.me self-send fallback in-app (docs/03-mvp-spec.md S4).

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
