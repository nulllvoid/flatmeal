import { createClient } from 'npm:@supabase/supabase-js@2';

// Service-role client for Edge Functions — bypasses RLS.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the app; it lives only in
// Edge Function env (see docs/04-architecture.md "No secrets in the app").
export function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in function env');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
