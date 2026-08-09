-- Replace the single-winner poll/vote system with a shared, multi-item,
-- live-edited cart for main courses + accompaniments. See docs/05-schema.sql
-- for full column comments.
--
-- Clean cutover (pre-pilot, no staging environment, no data-preservation
-- requirement stated in docs) — drops votes/accompaniment_votes and the
-- winner_* columns outright rather than dual-writing or archiving.
-- poll_options / poll_accompaniment_options are KEPT, repurposed as "the
-- day's suggestions" instead of "the voted-on options" — no shape change.

-- ============ drop vote-era tables & columns ============

drop table if exists accompaniment_votes;
drop table if exists votes;

alter table daily_polls
  drop column if exists winner_recipe_id,
  drop column if exists winner_reason,
  drop column if exists winner_accompaniment_recipe_id,
  drop column if exists winner_accompaniment_reason;

-- ============ cart_items ============

create table cart_items (
  poll_id uuid not null references daily_polls(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  quantity int not null check (quantity > 0),
  added_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (poll_id, recipe_id)
);

alter table cart_items enable row level security;

create policy "cart_items: members read" on cart_items
  for select using (
    exists (select 1 from daily_polls p where p.id = poll_id and is_flat_member(p.flat_id))
  );

-- Shared cart, not per-user votes: any flat member can edit/delete any cart
-- line (no user_id-ownership check), but only while the poll is still open —
-- this is the lock-at-close mechanism (enforced here at the RLS layer, not
-- via a copy-on-close snapshot table; the cart_items rows in place at close
-- time ARE the snapshot).
create policy "cart_items: members write while open" on cart_items
  for all using (
    exists (select 1 from daily_polls p
            where p.id = poll_id and is_flat_member(p.flat_id) and p.status = 'open')
  ) with check (
    exists (select 1 from daily_polls p
            where p.id = poll_id and is_flat_member(p.flat_id) and p.status = 'open')
  );

alter publication supabase_realtime add table cart_items;
