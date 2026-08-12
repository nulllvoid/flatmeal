# Groups refactor — UI/UX first, backend stubbed

**Date:** 2026-08-11 · **Status:** approved (design reviewed in session) · **Scope:** app UI only; backend unchanged, gaps stubbed client-side.

## Goal

Four approved changes, delivered as a UI/UX pass with the backend stubbed where it doesn't exist yet:

1. User onboarding (identity + diet) is separated from household setup and comes first.
2. After user onboarding, the user chooses **Create a group** or **Join with a code**.
3. **Groups replace flats** in the product language and model. One group = one meal + one cook + its own poll timings + its own daily cart + its own invite code + its own members. A user can belong to several groups (e.g. a breakfast group and a dinner group covering the same household).
4. All user-visible copy becomes **meal-dynamic** (breakfast / lunch / dinner) instead of hardcoding "dinner".

## Concept model and backend mapping

A **group** maps 1:1 onto the existing `flats` row, which already carries exactly the shape a group needs: one active cook (`cooks` partial unique index), one schedule (`poll_open_time` / `poll_close_time` / `dispatch_time`), one `invite_code`, one daily poll pipeline, one member list (`flat_members`). **No schema change in this pass.** The word "flat" disappears from all UI copy; the database keeps its names.

The one field a group needs that the schema lacks is `meal_type` (`'breakfast' | 'lunch' | 'dinner'`). It lives in a client-side stub keyed by group id (AsyncStorage), defaulting to `'dinner'`, and is clearly marked as the future `flats.meal_type` column.

Multi-group membership: the DB already tolerates multiple `flat_members` rows per user (the one-flat cap was an app-level convention in `use-my-flat.ts`). A new `useMyGroups` hook returns all memberships; `useMyFlat` is retired.

Trade-off accepted in review: invites are **per group**, so a household with two groups shares two codes. A bundled household invite is future work.

## Onboarding flow

```
auth (magic link, unchanged)
  → /onboarding/profile      "about you": display name + diet type + Jain + allergies
  → /onboarding/choose       "Create a group" | "Join with a code"
      create → /onboarding/create-group   group name + meal picker
                → /onboarding/cook        cook name/phone/language + invite code share
                → /(tabs)
      join   → /onboarding/join-group     code entry (stubbed lookup)
                → /(tabs) on (stub) success
```

- `onboarding/index.tsx` (auth) routes to `/onboarding/profile` after session; if the profile already exists **and** the user has ≥1 group, root redirect sends them to tabs as before.
- `onboarding/diet.tsx` is merged into `profile.tsx` and deleted.
- `onboarding/limits.tsx` (soft cart caps) leaves onboarding entirely; the same steppers appear in the group card in Settings. File deleted.
- `create-flat.tsx` becomes `create-group.tsx`: name + meal picker (3 chips). Creates the `flats` + `flat_members` rows for real (that path works today) and writes the chosen meal to the stub store.
- `cook.tsx` stays as the final create step; copy updated (no "flat" wording).
- `join-group.tsx`: full UI (input, validation, loading, error states). The lookup itself is a stub that returns a friendly "joining isn't wired up in this build yet" failure — an honest stub rather than a fake success that would dead-end on a nonexistent group. Real join needs a security-definer RPC / edge function (RLS blocks non-members from reading `flats` by invite code) — out of scope here, marked TODO.
- Stale sign-in tagline ("Vote in 5 seconds") replaced with meal-neutral cart copy.

## Today tab

- **Meal chips** at the top — one per group the user belongs to, labeled by the group's meal, sorted breakfast → lunch → dinner. Selecting a chip switches the entire screen's scope (cart, suggestions, activity, headcount, out-toggle). With exactly one group the chips row is hidden and the screen renders as it does today.
- Active group selection lives in a lightweight React context (`ActiveGroupProvider` under the root layout) exposing `{ groups, activeGroup, setActiveGroupId }`, so `grocery-list`, `who-is-eating`, and `cook-message-preview` scope to the same group as Today. Default: first group in meal order; selection kept in memory.
- All screens swap `useMyFlat` for the active group id.

## Meal-dynamic copy

New module `src/lib/meal-copy.ts` — the only place meal words live:

- `mealNoun(meal)` → "breakfast" / "lunch" / "dinner"
- `mealTitle(meal)` → "Breakfast today" / "Lunch today" / "Dinner tonight"
- `mealMoment(meal)` → "today" / "today" / "tonight" (used in "3 eating tonight", locked-card stat, attendance notices)
- `mealShareHeading(meal)` → "🛒 Breakfast:" / "🛒 Lunch:" / "🛒 Tonight:"

Swept call sites: Today header, out-toggle context, locked card, empty/no-poll states, empty-lock fallback card, search modal, who-is-eating, grocery list share text, cook message preview empty state, onboarding copy.

## Settings

- "My dietary profile" section unchanged (plus it already edits the same columns the new onboarding profile screen writes).
- Flat section becomes **"My groups"**: one card per group — name, meal (editable via stub), cook (existing `CookSection`), poll timings (read-only as today), invite code, members, soft-limit steppers (relocated from onboarding), and **Leave group** behind a confirmation dialog (fixes the current one-tap destructive leave).
- **"Add group"** button routes into `/onboarding/create-group` (same flow, reused).
- Each group card is its own component instance so `useFlatSettings(groupId)` runs per card without hook-in-loop issues.

## Stub layer

`src/lib/groups-stub.ts` — every not-yet-real behavior in one obvious place:

- `getMealType(groupId)` / `setMealType(groupId, meal)` — AsyncStorage, default `'dinner'`. TODO: `flats.meal_type` column.
- `joinGroupByCode(code)` — always `{ ok: false, reason: 'not-wired' }`. TODO: security-definer RPC or edge function.

Everything else (cart, grocery, attendance, streak, activity, dispatch preview) is already flat-scoped and works per-group unchanged against the live backend.

## Out of scope / caveats

- No schema or Edge Function changes. The server pipeline still creates polls on each group's existing (dinner-defaulted) schedule — a breakfast group gets real polls only after the backend learns `meal_type`. UI is fully demonstrable regardless.
- No per-group member subsets beyond what separate invite codes naturally give.
- No household bundling of invites.
- Push notifications, pre-dispatch message composition, and the other review findings are separate work.

## Verification

- `npx tsc --noEmit` and `npx expo lint` clean (no test runner is configured for the app; Playwright e2e specs reference flat copy and are updated only where selectors break).
- Manual flow check on web (`npx expo start` → `w`): fresh onboarding → profile → choose → create group (meal picker) → cook → Today shows meal-correct copy; second group via Settings "Add group" → chips appear and switch scope; grocery share text uses the meal heading; leave group asks for confirmation.
