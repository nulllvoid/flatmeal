-- Enables Realtime change events for tables the app subscribes to
-- (docs/02-prd.md "live vote counts visible", grocery_checks sync).
-- Supabase's Realtime server only emits postgres_changes for tables
-- explicitly added to this publication.

alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table daily_polls;
alter publication supabase_realtime add table grocery_checks;
