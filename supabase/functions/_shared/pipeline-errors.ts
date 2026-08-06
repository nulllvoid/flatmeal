import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type PipelineStage = 'create_poll' | 'close_poll' | 'dispatch_cook' | 'wa_webhook';

// Every stage failure is logged to pipeline_errors (docs/03-mvp-spec.md
// "Daily pipeline" step 4) and should additionally alert the founder via
// webhook — TODO: call the alert webhook URL from env once configured.
export async function logPipelineError(
  admin: SupabaseClient,
  stage: PipelineStage,
  detail: Record<string, unknown>,
  flatId?: string
) {
  await admin.from('pipeline_errors').insert({ stage, flat_id: flatId ?? null, detail });
}
