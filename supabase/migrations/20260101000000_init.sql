-- FlatMeal v1 schema (Supabase / Postgres)
-- Generated from docs/05-schema.sql — that file is the source of truth.
-- Edit docs/05-schema.sql first, then regenerate/hand-sync this migration.

-- ============ identity & household ============

create table profiles (                      -- 1:1 with auth.users
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  diet_type text not null default 'veg' check (diet_type in ('veg','egg','nonveg')),
  is_jain boolean not null default false,
  allergies text[] not null default '{}',    -- values from: peanut,dairy,gluten,shellfish,soy
  push_token text,
  notifications_muted boolean not null default false,
  created_at timestamptz not null default now()
);

create table flats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(6),'hex'),
  poll_open_time time not null default '09:00',
  poll_close_time time not null default '11:00',
  dispatch_time time not null default '16:00',
  tz text not null default 'Asia/Kolkata',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table flat_members (
  flat_id uuid not null references flats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (flat_id, user_id)
);

create table cooks (                          -- separate table: supports cook turnover history
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats(id) on delete cascade,
  name text not null,
  phone text not null,                        -- E.164
  language text not null default 'hi' check (language in ('hi','kn','en')),
  is_active boolean not null default true,
  audit_note text,                            -- who changed what, plain text
  created_at timestamptz not null default now()
);
create unique index one_active_cook_per_flat on cooks(flat_id) where is_active;

-- ============ recipe dataset (global, curated) ============

create table recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                  -- 'palak-paneer'
  name text not null,
  cuisine text not null,                      -- north_indian | south_indian | ...
  base text not null,                         -- primary base for variety heuristic: paneer|dal|rice|roti-sabzi|...
  diet_class text not null check (diet_class in ('veg','egg','nonveg')),
  jain_ok boolean not null default false,
  allergens text[] not null default '{}',
  seasons text[] not null default '{kharif,rabi,zaid}',  -- static seasonality tags (all = year-round)
  instructions_en text not null,              -- imperative, written for the cook
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  name_en text not null,                      -- 'Spinach (palak)'
  name_hi text,
  name_kn text,
  qty_per_person numeric not null,            -- multiplied by headcount, then rounded per unit rules
  unit text not null check (unit in ('piece','g','ml','bunch','packet','cup','tbsp','tsp')),
  category text not null check (category in ('vegetable','dairy','staple','protein','other')),
  is_staple boolean not null default false,   -- staples render as "check you have:" line, excluded from buy list
  sort_order int not null default 0
);

create table recipe_translations (            -- reviewed translation cache for instruction bodies
  recipe_id uuid not null references recipes(id) on delete cascade,
  language text not null check (language in ('hi','kn')),
  instructions text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  primary key (recipe_id, language)
);

-- ============ daily loop ============

create table daily_polls (
  id uuid primary key default gen_random_uuid(),
  flat_id uuid not null references flats(id) on delete cascade,
  poll_date date not null,
  status text not null default 'open' check (status in ('open','closed','cancelled','dispatched')),
  winner_recipe_id uuid references recipes(id),
  winner_reason text check (winner_reason in ('votes','tiebreak_lru','auto_no_votes')),
  flat_note text,                             -- 'less spicy today' — editable until dispatch
  created_at timestamptz not null default now(),
  unique (flat_id, poll_date)                 -- idempotent creation
);

create table poll_options (
  poll_id uuid not null references daily_polls(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  position int not null check (position between 1 and 3),
  primary key (poll_id, recipe_id)
);

create table votes (
  poll_id uuid not null references daily_polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id uuid not null references recipes(id),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)              -- one changeable vote per member
);

create table day_attendance (                 -- "I'm out today"
  flat_id uuid not null references flats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  poll_date date not null,
  is_out boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (flat_id, user_id, poll_date)
);

create table grocery_checks (                 -- "we already have this" ticks, realtime-synced
  poll_id uuid not null references daily_polls(id) on delete cascade,
  ingredient_id uuid not null references recipe_ingredients(id),
  checked_by uuid references profiles(id),
  checked_at timestamptz not null default now(),
  primary key (poll_id, ingredient_id)
);

create table dispatch_log (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references daily_polls(id) on delete cascade,
  mode text not null check (mode in ('mock','live')),
  language text not null,
  headcount int not null,
  payload_en text not null,
  payload_translated text not null,
  bsp_message_id text,
  status text not null default 'queued' check (status in ('queued','mocked','sent','delivered','read','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- flat's meal history for 10-day exclusion + LRU tie-break:
-- derived from daily_polls where status='dispatched' (no separate table needed).
create index polls_flat_date on daily_polls(flat_id, poll_date desc);

-- ============ pilot feedback & ops ============

create table meal_feedback (                  -- next-morning 👍/👎
  poll_id uuid not null references daily_polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  thumbs_up boolean not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table feedback (                       -- free-text app feedback
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  flat_id uuid references flats(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table pipeline_errors (
  id uuid primary key default gen_random_uuid(),
  stage text not null,                        -- create_poll | close_poll | dispatch_cook | wa_webhook
  flat_id uuid,
  detail jsonb not null,
  created_at timestamptz not null default now()
);
