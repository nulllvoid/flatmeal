# FlatMeal E2E test suite

Playwright tests that run against the **real, live Supabase project**
(`pcmtsfcjzoivagpslpch`) and the real dev server — there is no mocked
backend. This mirrors how the app was actually built and tested throughout
development: seed real DB state, trigger the real deployed Edge Functions,
verify the real running app.

## Prerequisites

1. Dev server running: `npx expo start --web --port 8081` (the config will
   reuse an already-running server on that port, or start one itself).
2. Supabase CLI authenticated against the linked project — already the case
   in the standard dev environment for this repo (`npx supabase db query
   --linked "select 1"` should work with no extra login).
3. `SUPA_JWT` set in `app/.env` — the project's JWT signing secret
   (Dashboard → Settings → API → JWT Settings). Required because these
   tests authenticate multiple concurrent users, and real magic-link email
   delivery is unavailable in this environment (see "Why forged sessions"
   below). **Never commit this value** — `.env` is gitignored.

## Running

```bash
npm run test:e2e          # headless run, HTML report written to ../e2e-report
npm run test:e2e:ui       # Playwright's interactive UI mode
```

## Test data setup (one-time)

The suite drives 3 flatmates in the same flat (`TEST_FLAT_ID` in
`fixtures/test-users.ts`): the real dev account (`shivik2541@gmail.com`)
plus two synthetic profiles (`Priya`, `Rahul` — deliberately veg/veg/nonveg
so dietary-veto tests have something to assert on). If these don't exist
yet in the linked project, seed them once:

```sql
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'test-flatmate-1@flatmeal.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'test-flatmate-2@flatmeal.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into profiles (id, display_name, diet_type, is_jain, allergies) values
  ('11111111-1111-1111-1111-111111111111', 'Priya (test)', 'veg', false, '{}'),
  ('22222222-2222-2222-2222-222222222222', 'Rahul (test)', 'nonveg', false, '{}')
on conflict (id) do update set display_name = excluded.display_name, diet_type = excluded.diet_type;

insert into flat_members (flat_id, user_id, role) values
  ('<TEST_FLAT_ID>', '11111111-1111-1111-1111-111111111111', 'member'),
  ('<TEST_FLAT_ID>', '22222222-2222-2222-2222-222222222222', 'member')
on conflict (flat_id, user_id) do nothing;
```

Update `TEST_FLAT_ID` in `fixtures/test-users.ts` to match whichever flat
you seed into.

## Why forged sessions

The app's only auth path is magic-link email. Supabase's built-in email
sender on this project is unreliable (accepts `signInWithOtp` requests with
HTTP 200 but silently never delivers — confirmed during earlier manual
testing this session), so driving the real login flow isn't viable for an
automated suite, let alone for 3 concurrent users.

Instead, `fixtures/test-users.ts#mintSession()` signs a session JWT locally
using the project's own JWT secret and backs it with a real row in
`auth.sessions`, then `fixtures/auth.ts` injects it into each browser
context's `localStorage` before the app loads — the same storage key and
shape `@supabase/supabase-js` writes on a real login. This is
environment-specific test tooling, not something the app does or should do;
it only works because we hold the JWT secret directly. Fixing the
underlying email deliverability (custom SMTP) would let a future version of
this suite drive real magic-link logins instead.

## Why serial (not parallel)

All specs act on one shared flat (`TEST_FLAT_ID`) and one poll-per-day row.
Running specs in parallel would mean two test files racing to seed/close/
reset the same `daily_polls` row for today's date, corrupting each other's
state. `playwright.config.ts` sets `fullyParallel: false` and `workers: 1`
deliberately. If this suite needs to speed up, the fix is giving each spec
file its own flat (more `TEST_USERS`-style fixtures), not parallelizing
against shared state.

## Known gap this suite surfaced

**The Today screen doesn't pick up a poll appearing/changing after the page
has already mounted, without a reload.** `use-today-poll.ts`'s realtime
subscription only exists once `poll` is non-null (`if (!poll) return;`
guards the subscribe effect) — so a page that loaded while there was no
poll yet, or while the poll was still open, never learns a poll now exists
or has closed/dispatched without a manual refresh. Every test in this suite
that seeds/closes/dispatches a poll from outside the page (via `dbQuery` or
the real Edge Functions) has to call `page.reload()` afterward to see the
result — clicking the "Today" tab alone is not enough. A real user would
naturally reopen the app around poll-open/close/dispatch time, so this is a
soft gap rather than a broken feature, but it's a real one: a user who
leaves the app open across a poll transition sees stale state until they
refresh. Worth a follow-up (either a lightweight poll or picking up
`daily_polls` UPDATE events regardless of whether a poll was already
loaded).

## Structure

```
e2e/
  playwright.config.ts
  fixtures/
    test-users.ts    — fixed test user IDs + mintSession() (JWT forging)
    auth.ts           — Playwright test.extend with ownerPage/priyaPage/rahulPage
    db.ts             — dbQuery() wrapper around `supabase db query --linked`
    poll-state.ts      — triggerCreatePoll/ClosePoll/DispatchCook, resetPollState
    seed-poll.ts       — seedOpenPoll, castVoteAsUser, castAccompanimentVoteAsUser
  tests/
    settings.spec.ts              — Settings screen: profile, cook, feedback, leave-flat
    voting-multiuser.spec.ts      — concurrent voting, realtime, out-today, dietary veto
    poll-lifecycle.spec.ts        — close_poll: majority/tie/auto-pick/cancel, dispatched-status UI
    accompaniment.spec.ts         — the 5-state accompaniment vote UI machine
    grocery-and-dispatch.spec.ts  — scaling, staples, checklist realtime, dispatch_cook edge cases
```
