-- Fixes a bug in 20260101000001_rls.sql: INSERT ... RETURNING (used by
-- `.insert().select()` in supabase-js) requires the SELECT policy to pass
-- for the newly-inserted row. The original "flats: members read" policy
-- only allowed existing flat_members to read a flat, but the app creates
-- flats and flat_members as two separate requests — at insert time the
-- creator isn't a member yet, so the RETURNING clause failed RLS and
-- PostgREST reported it as "new row violates row-level security policy".

drop policy "flats: members read" on flats;

create policy "flats: members read" on flats
  for select using (is_flat_member(id) or created_by = auth.uid());
