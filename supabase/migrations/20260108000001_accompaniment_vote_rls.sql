-- RLS for accompaniment vote tables, mirroring the existing patterns for
-- recipes/poll_options/votes in 20260101000001_rls.sql.

alter table recipe_accompaniments enable row level security;

create policy "recipe_accompaniments: authenticated read" on recipe_accompaniments
  for select to authenticated using (true);

alter table poll_accompaniment_options enable row level security;

create policy "poll_accompaniment_options: members read" on poll_accompaniment_options
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

alter table accompaniment_votes enable row level security;

create policy "accompaniment_votes: members read" on accompaniment_votes
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "accompaniment_votes: members cast own vote" on accompaniment_votes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "accompaniment_votes: members change own vote" on accompaniment_votes
  for update using (user_id = auth.uid());

create policy "accompaniment_votes: members remove own vote" on accompaniment_votes
  for delete using (user_id = auth.uid());
