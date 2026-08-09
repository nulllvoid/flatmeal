-- Phase 4 groundwork for the Organic redesign (see docs/05-schema.sql for
-- full column comments):
--   1. recipes.kind gains 'side' (pickle/raita/papad/salad), alongside the
--      existing 'main'/'accompaniment'. No recipe rows are migrated to it
--      here — side-dish content is a separate curation task; the schema
--      just makes room for it.
--   2. flats gains soft, warn-only max_mains/max_accompaniments caps.
--   3. day_attendance write policies widen from "self only" to "any flat
--      member" so one flatmate can mark another in/out (the "who's eating"
--      flow) — matches the trust model cart_items already uses.
--   4. activity_log: new table backing the live "who did what" cart feed.

-- ============ recipes.kind: add 'side' ============

alter table recipes drop constraint recipes_kind_check;
alter table recipes add constraint recipes_kind_check
  check (kind in ('main','accompaniment','side'));

-- ============ flats: soft cart limits ============

alter table flats add column max_mains int;
alter table flats add column max_accompaniments int;

-- ============ day_attendance: widen writes to any flat member ============

drop policy "day_attendance: members set own" on day_attendance;
drop policy "day_attendance: members update own" on day_attendance;

create policy "day_attendance: members set" on day_attendance
  for insert with check (is_flat_member(flat_id));

create policy "day_attendance: members update" on day_attendance
  for update using (is_flat_member(flat_id));

-- ============ activity_log ============

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats(id) on delete cascade,
  poll_id uuid references daily_polls(id) on delete cascade,
  actor_id uuid references profiles(id),
  event_type text not null check (event_type in
    ('cart_add','cart_remove','cart_quantity_change','attendance_change')),
  recipe_id uuid references recipes(id),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_log_poll on activity_log(poll_id, created_at desc);

alter table activity_log enable row level security;

create policy "activity_log: members read" on activity_log
  for select using (is_flat_member(flat_id));

create policy "activity_log: members insert" on activity_log
  for insert with check (is_flat_member(flat_id));

alter publication supabase_realtime add table activity_log;
