# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read this before doing anything. Then read `docs/02-prd.md` and `docs/03-mvp-spec.md`.

## Repo status

Wired to a real Supabase project (`pcmtsfcjzoivagpslpch`) — not a local/mock setup. `/app` queries Supabase directly (auth, votes, grocery list, settings all live). `/supabase`'s `create_poll`, `close_poll`, and `dispatch_cook` Edge Functions are fully implemented (dietary veto, 10-day exclusion, variety heuristic, ingredient scaling, translation cache with graceful fallback) and deployed; `dispatch_cook`'s live BSP send is still unimplemented (mock mode only — no BSP account provisioned yet). pg_cron + pg_net are enabled and scheduled to invoke all three functions every 15 minutes (`supabase/migrations/20260108000003_pg_cron.sql`); each function self-selects which flats are due by comparing its configured time against current IST.

```
/app          Expo app (Expo Router, TypeScript) — see app/CLAUDE.md
/supabase     migrations/ (from docs/05-schema.sql + RLS + pg_cron), functions/ (create_poll, close_poll, dispatch_cook implemented; wa_webhook still a stub), seed/ (CSV loader)
/data         recipe + ingredient CSVs (source of truth for seeding)
/docs         product/architecture docs
```

### Commands (run from `/app`)

- `npm install` — install deps
- `npx expo start` — dev server (press `a` for Android emulator, `w` for web)
- `npx tsc --noEmit` — typecheck
- `npx expo lint` — lint
- Copy `app/.env.example` to `app/.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` before the app can reach a real Supabase project. `src/lib/supabase.ts` throws at import time if these are missing.
- No test runner is configured yet.

### Supabase (linked to the live project — most work happens against it directly, not local)

- Project ref `pcmtsfcjzoivagpslpch`. The Supabase CLI (`npx supabase`) works against it without extra login in this environment.
- `npx supabase db push` applies new migrations from `supabase/migrations/`. `npx supabase db query --linked "<sql>"` (or `--file <path>` for multi-line SQL) runs ad-hoc queries directly — the practical way to inspect/seed data without a service-role key on hand.
- `npx supabase functions deploy <name> --project-ref pcmtsfcjzoivagpslpch` deploys a single Edge Function; all three (`create_poll`, `close_poll`, `dispatch_cook`) have `verify_jwt = false` (see `supabase/config.toml`), so they can be curled directly with no auth header for manual testing.
- Seed script: `npx tsx supabase/seed/seed-recipes.ts` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars — not available in this dev environment; new recipe/seed data has instead been inserted via `db query` SQL directly against the live project when needed).
- Local Supabase (`supabase start`) is not used in this workflow — `supabase/config.toml` exists but development happens against the live project.

## Doc reading order

| Path | Purpose |
|---|---|
| `docs/01-research-original.md` | Founder's original long-term vision (v5+). Sections marked ⚠️ are explicitly deferred/corrected for v1 — don't build from this file directly, cross-check against `02-prd.md` |
| `docs/02-prd.md` | Product requirements — problem, personas, exhaustive MVP scope (§4) and out-of-scope (§5) |
| `docs/03-mvp-spec.md` | Screen-by-screen spec, flows, edge cases, the daily server pipeline |
| `docs/04-architecture.md` | Tech stack, target repo layout, key decisions, dispatch sequence diagram |
| `docs/05-schema.sql` | Postgres schema — **source of truth for the data model** |
| `docs/06-whatsapp-integration.md` | BSP setup, Hindi/Kannada/English message templates, dispatch composition pipeline |
| `docs/07-roadmap-and-pilot.md` | 4-week build plan, pilot success metrics, decision gates |

## What this product is

Flatmates in Indian metros (pilot: Bengaluru) share a domestic cook. The app removes the daily "what's for dinner" coordination burden:

1. **09:00** — app creates a daily poll with 3 curated dish options (filtered by flat's dietary tags, no repeats within 10 days).
2. Flatmates tap to vote (async, votes visible to each other). "I'm out today" toggle adjusts headcount.
3. **11:00** — poll closes. Tie-break = least-recently-eaten dish.
4. App renders the grocery list scaled to headcount; a flatmate ticks off what's already in the kitchen and shares the rest to WhatsApp / copies it.
5. **16:00** — winning dish + headcount + scaled ingredients + notes are translated to the cook's language and sent via WhatsApp Business API (through a BSP).

The users are NOT cooks. They know dish names, not ingredients. The ingredient data in our curated recipe DB is what makes the grocery list possible — there is no NLP/recipe-parsing anywhere.

## Stack (fixed — do not substitute)

- **App:** Expo (React Native) + TypeScript. Distribution: EAS Build APK links for pilot (Android-first), TestFlight later. EAS Update for OTA fixes.
- **Backend:** Supabase — Postgres, Auth (phone/OTP or magic link), Realtime (live vote counts), Edge Functions + pg_cron (poll creation, poll close, cook dispatch).
- **WhatsApp:** BSP (AiSensy or Interakt) calling Meta WhatsApp Business API. Utility templates only. See `docs/06-whatsapp-integration.md`.
- **Translation:** Google Cloud Translate v1 (Hindi, Kannada first). TTS voice notes (Sarvam AI / Google TTS) are a stretch goal, week 4 only.

## Hard scope guardrails (v1)

DO NOT build, stub, or scaffold:
- Digital pantry / inventory tracking (humans tick a checklist instead)
- Quick-commerce cart APIs or price scraping (Blinkit/Zepto have no public partner APIs; at most, open their search page via URL scheme for an item)
- ML/collaborative-filtering recommender (v1 selection = tag filter + rotation + simple randomization)
- Expense splitting / ledger (users already have Splitwise)
- Cook-facing app or two-way cook chatbot (one-way dispatch only in v1; cook replies land in the flat's normal WhatsApp group)
- iOS store release

## Conventions

- Schema changes: edit `docs/05-schema.sql` first, generate migration, then code against it.
- All user-visible times are IST (Asia/Kolkata). Poll times are per-flat configurable, defaults 09:00 create / 11:00 close / 16:00 dispatch.
- Ingredient quantities are stored per-person; UI multiplies by headcount. Units must be purchasable (pieces, g, ml, packets). Spices/staples flagged `is_staple = true` and rendered as a single "check you have: …" line, not in the buy list.
- Recipe instruction text is written for the cook, imperative, plain English; translation happens at dispatch time, never stored pre-translated (except optional ingredient name_hi/name_kn columns for list readability).
- WhatsApp dispatch must be mockable: `DISPATCH_MODE=mock|live` env; mock logs payloads to `dispatch_log` without calling the BSP.
- Keep the app to 4 screens (Flat setup / Today's vote / Grocery checklist / Settings). Push back on screen sprawl.
- RLS on every flat-scoped table: members can read/write only their own flat (`flat_id` match). `recipes`/`recipe_ingredients`/`recipe_translations` are global read-only to authenticated users; writes are service-role only.
- Poll creation is deterministic and idempotent: option selection is seeded by `(flat_id, date)`, and `daily_polls` upserts on `unique (flat_id, poll_date)` — re-running `create_poll` for a flat/day must not change or duplicate results.
- Meal history for the 10-day no-repeat rule and least-recently-eaten tie-break is derived from `daily_polls` (status = `dispatched`), not a separate history table.

## Definition of done for MVP

A 3-person flat can: onboard, set cook phone + language, vote daily with realtime counts, see a headcount-scaled grocery checklist for the winner, share the missing-items list, and the cook receives a correctly translated WhatsApp message at dispatch time. Pilot metrics in `docs/07-roadmap-and-pilot.md`.
