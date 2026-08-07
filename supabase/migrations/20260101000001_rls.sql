-- Row-level security (docs/04-architecture.md "RLS everywhere"):
-- every flat-scoped table restricted to that flat's members.
-- recipes/recipe_ingredients/recipe_translations are global read-only to
-- authenticated users; writes are service-role only (RLS is skipped
-- entirely for the service role, so no explicit write policy is needed —
-- just no policy that grants it to `authenticated`).

create or replace function is_flat_member(target_flat_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from flat_members
    where flat_id = target_flat_id and user_id = auth.uid()
  );
$$;

-- ============ profiles ============
alter table profiles enable row level security;

create policy "profiles: read own row" on profiles
  for select using (id = auth.uid());

-- flatmates need to see each other's dietary profile (F1) and voter names (F2)
create policy "profiles: read flatmates" on profiles
  for select using (
    exists (
      select 1 from flat_members mine
      join flat_members theirs on theirs.flat_id = mine.flat_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "profiles: update own row" on profiles
  for update using (id = auth.uid());

create policy "profiles: insert own row" on profiles
  for insert with check (id = auth.uid());

-- ============ flats ============
alter table flats enable row level security;

-- Includes created_by = auth.uid() so a freshly-inserted row satisfies the
-- RETURNING clause's implicit SELECT check before the creator's
-- flat_members row exists (the client inserts flats then flat_members as
-- two separate requests, not atomically).
create policy "flats: members read" on flats
  for select using (is_flat_member(id) or created_by = auth.uid());

create policy "flats: members update" on flats
  for update using (is_flat_member(id));

create policy "flats: authenticated create" on flats
  for insert with check (created_by = auth.uid());

-- ============ flat_members ============
alter table flat_members enable row level security;

create policy "flat_members: members read" on flat_members
  for select using (is_flat_member(flat_id));

create policy "flat_members: self join" on flat_members
  for insert with check (user_id = auth.uid());

create policy "flat_members: self leave" on flat_members
  for delete using (user_id = auth.uid());

-- ============ cooks ============
alter table cooks enable row level security;

create policy "cooks: members read" on cooks
  for select using (is_flat_member(flat_id));

create policy "cooks: members write" on cooks
  for all using (is_flat_member(flat_id)) with check (is_flat_member(flat_id));

-- ============ recipes (global, read-only to authenticated) ============
alter table recipes enable row level security;

create policy "recipes: authenticated read" on recipes
  for select to authenticated using (true);

alter table recipe_ingredients enable row level security;

create policy "recipe_ingredients: authenticated read" on recipe_ingredients
  for select to authenticated using (true);

alter table recipe_translations enable row level security;

create policy "recipe_translations: authenticated read" on recipe_translations
  for select to authenticated using (true);

-- ============ daily loop (flat-scoped) ============
alter table daily_polls enable row level security;

create policy "daily_polls: members read" on daily_polls
  for select using (is_flat_member(flat_id));

create policy "daily_polls: members update flat_note" on daily_polls
  for update using (is_flat_member(flat_id));

alter table poll_options enable row level security;

create policy "poll_options: members read" on poll_options
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

alter table votes enable row level security;

create policy "votes: members read" on votes
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "votes: members cast own vote" on votes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "votes: members change own vote" on votes
  for update using (user_id = auth.uid());

create policy "votes: members remove own vote" on votes
  for delete using (user_id = auth.uid());

alter table day_attendance enable row level security;

create policy "day_attendance: members read" on day_attendance
  for select using (is_flat_member(flat_id));

create policy "day_attendance: members set own" on day_attendance
  for insert with check (user_id = auth.uid() and is_flat_member(flat_id));

create policy "day_attendance: members update own" on day_attendance
  for update using (user_id = auth.uid());

alter table grocery_checks enable row level security;

create policy "grocery_checks: members read" on grocery_checks
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "grocery_checks: members toggle" on grocery_checks
  for all using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  ) with check (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

alter table dispatch_log enable row level security;

create policy "dispatch_log: members read" on dispatch_log
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

-- ============ pilot feedback & ops ============
alter table meal_feedback enable row level security;

create policy "meal_feedback: members read" on meal_feedback
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

create policy "meal_feedback: members submit own" on meal_feedback
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

alter table feedback enable row level security;

create policy "feedback: members submit own" on feedback
  for insert with check (user_id = auth.uid());

create policy "feedback: members read own" on feedback
  for select using (user_id = auth.uid());

-- pipeline_errors: no policies for `authenticated` — service role only (RLS
-- bypassed for service role), consistent with founder-alerting being
-- backend-internal, not app-facing.
alter table pipeline_errors enable row level security;
