# FlatMeal (working name)

A low-friction meal-planning app for shared households (flatmates) in Indian metros that employ a daily domestic cook.

**Core loop:** curated daily meal vote → auto-scaled grocery list → vernacular WhatsApp instructions to the cook.

## Repo map

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Context + conventions for AI agents working in this repo |
| `docs/01-research-original.md` | Founder's original strategic research (full vision, long-term) |
| `docs/02-prd.md` | Product requirements — problem, personas, MVP scope, out-of-scope |
| `docs/03-mvp-spec.md` | Screen-by-screen MVP spec, flows, edge cases |
| `docs/04-architecture.md` | Tech stack, system design, integration notes |
| `docs/05-schema.sql` | Supabase/Postgres schema (source of truth for data model) |
| `docs/06-whatsapp-integration.md` | BSP setup, message templates (Hindi/Kannada), dispatch flow |
| `docs/07-roadmap-and-pilot.md` | 4-week build plan, pilot success metrics |
| `data/recipes-template.csv` | Column template + sample rows for recipe data entry |
| `data/ingredients-template.csv` | Column template + sample rows for per-recipe ingredients |
| `app/` | Expo (React Native + TypeScript) app — Expo Router, 4 MVP screens scaffolded with mock data |
| `supabase/` | Postgres migration (from `docs/05-schema.sql`) + RLS policies, Edge Function stubs, CSV seed script |

## Status

Scaffolded. `app/` and `supabase/` exist with working structure, but no Supabase project has been created/linked yet, and screens use mock data (no live queries, no auth). Next steps: create the Supabase project (Mumbai region), apply migrations, wire up phone-OTP auth and real queries per `docs/07-roadmap-and-pilot.md` Week 1–2.

## Golden rules

1. MVP scope is defined in `docs/02-prd.md` §4. Anything not listed there is **out of scope** — do not build it, however tempting (no digital pantry, no Q-comm cart APIs, no ML recommender, no expense ledger in v1).
2. `docs/05-schema.sql` is the single source of truth for the data model. Update it first, then code.
3. The recipe/ingredient dataset is a first-class product asset. Quantities must be buyable by non-cooks ("2 medium onions", "200g paneer"), never "1 katori" or "to taste".
4. Longest-lead-time item is WhatsApp/Meta template approval — never block on it; build with a mock dispatcher until approved.
