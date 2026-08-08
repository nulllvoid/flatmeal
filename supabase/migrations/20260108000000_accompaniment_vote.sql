-- Accompaniment (roti/rice/jeera rice) vote: second, independent per-person
-- vote on what starch to serve alongside the winning main dish. See
-- docs/05-schema.sql for full column comments.

alter table recipes add column kind text not null default 'main' check (kind in ('main','accompaniment'));

create table recipe_accompaniments (
  main_recipe_id uuid not null references recipes(id) on delete cascade,
  accompaniment_recipe_id uuid not null references recipes(id) on delete cascade,
  sort_order int not null default 0,
  primary key (main_recipe_id, accompaniment_recipe_id)
);

alter table daily_polls
  add column winner_accompaniment_recipe_id uuid references recipes(id),
  add column winner_accompaniment_reason text check (winner_accompaniment_reason in ('votes','tiebreak_lru','auto_no_votes','none_available'));

create table poll_accompaniment_options (
  poll_id uuid not null references daily_polls(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  position int not null check (position between 1 and 3),
  primary key (poll_id, recipe_id)
);

create table accompaniment_votes (
  poll_id uuid not null references daily_polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
