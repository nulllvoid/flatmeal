-- Schedules create_poll, close_poll, and dispatch_cook to run every 15
-- minutes via pg_cron + pg_net, so the daily pipeline (docs/03-mvp-spec.md
-- "Daily pipeline") actually runs without a human invoking each function
-- manually. Each function self-selects which flats are due this tick by
-- comparing its configured poll_open_time/poll_close_time/dispatch_time
-- against the current IST time (see supabase/functions/_shared/ist-time.ts)
-- — the cron schedule itself doesn't need to know about individual flats.
--
-- No auth header is sent: all three functions have verify_jwt = false
-- (supabase/config.toml) and run with no bearer token requirement, same as
-- every manual invocation during development.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'create_poll_every_15_min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pcmtsfcjzoivagpslpch.supabase.co/functions/v1/create_poll',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

select cron.schedule(
  'close_poll_every_15_min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pcmtsfcjzoivagpslpch.supabase.co/functions/v1/close_poll',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

select cron.schedule(
  'dispatch_cook_every_15_min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://pcmtsfcjzoivagpslpch.supabase.co/functions/v1/dispatch_cook',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
