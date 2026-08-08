-- Enables Realtime change events for the accompaniment vote, same reasoning
-- as 20260107000001_enable_realtime.sql. poll_accompaniment_options doesn't
-- need it — it's written once by close_poll before the client ever sees
-- status='closed', same as poll_options today. daily_polls is already
-- published, so the winner_accompaniment_* UPDATE propagates for free.

alter publication supabase_realtime add table accompaniment_votes;
