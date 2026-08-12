# Groups Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "flat" with "group" (one meal + one cook + own cart per group, multiple groups per user) across the app UI with meal-dynamic copy, restructured onboarding, and a stubbed backend for the pieces that don't exist yet.

**Architecture:** A group maps 1:1 onto the existing `flats` row; no schema changes. A client-side stub supplies `meal_type` (AsyncStorage) and a not-wired `joinGroupByCode`. A new `ActiveGroupProvider` context replaces the single-flat assumption (`useMyFlat`) everywhere; all copy routes through `src/lib/meal-copy.ts`.

**Tech Stack:** Expo (React Native) + TypeScript, Expo Router, Supabase JS client, `@react-native-async-storage/async-storage` (already a dependency).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-groups-refactor-design.md`. All copy strings below are verbatim from or consistent with it.
- No schema, migration, or Edge Function changes. Database identifiers keep their `flat` names; only UI copy and app-layer naming change.
- No test runner exists (`app/CLAUDE.md`); the verification gate per task is `npx tsc --noEmit` and `npx expo lint` (run from `/app`), both clean, plus the listed manual checks.
- The word "flat" must not appear in any user-visible string after Task 8's sweep. Code identifiers touching Supabase tables (`flat_id`, `useFlatSettings`) may keep their names.
- Loading conventions: `undefined` = loading, `null`/`[]` = loaded-empty, matching existing hooks.
- Commit after every task on the `groups-refactor` branch. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Meal types, meal copy module, groups stub

**Files:**
- Modify: `app/src/types/domain.ts` (add `MealType`)
- Create: `app/src/lib/meal-copy.ts`
- Create: `app/src/lib/groups-stub.ts`

**Interfaces:**
- Produces: `MealType = 'breakfast' | 'lunch' | 'dinner'`; `MEAL_ORDER: MealType[]`; `mealNoun/mealTitle/mealMoment/mealShareHeading/mealLabel(meal: MealType): string`; `getMealType(groupId: string): Promise<MealType>`; `setMealType(groupId: string, meal: MealType): Promise<void>`; `joinGroupByCode(code: string): Promise<{ ok: false; reason: 'not-wired' }>`

- [ ] **Step 1: Add `MealType` to `app/src/types/domain.ts`**

```ts
// The meal a group covers. UI-only for now — stored in the groups stub
// (src/lib/groups-stub.ts) until a flats.meal_type column exists.
export type MealType = 'breakfast' | 'lunch' | 'dinner';
```

- [ ] **Step 2: Create `app/src/lib/meal-copy.ts`**

```ts
import type { MealType } from '@/types/domain';

// Every user-visible meal word lives here — screens must not hardcode
// "dinner"/"tonight" (design: docs/superpowers/specs/2026-08-11-groups-refactor-design.md).

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner'];

export function mealNoun(meal: MealType): string {
  return meal;
}

export function mealLabel(meal: MealType): string {
  return { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }[meal];
}

export function mealTitle(meal: MealType): string {
  return { breakfast: 'Breakfast today', lunch: 'Lunch today', dinner: 'Dinner tonight' }[meal];
}

export function mealMoment(meal: MealType): string {
  return meal === 'dinner' ? 'tonight' : 'today';
}

export function mealShareHeading(meal: MealType): string {
  return { breakfast: '🛒 Breakfast:', lunch: '🛒 Lunch:', dinner: '🛒 Tonight:' }[meal];
}
```

- [ ] **Step 3: Create `app/src/lib/groups-stub.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MealType } from '@/types/domain';

// Client-side stand-ins for backend that doesn't exist yet. Everything in
// this file is a stub by design — see the design doc's "Stub layer" section.

const mealKey = (groupId: string) => `flatmeal.group-meal.${groupId}`;

// TODO(backend): replace with a real flats.meal_type column + migration.
export async function getMealType(groupId: string): Promise<MealType> {
  const stored = await AsyncStorage.getItem(mealKey(groupId));
  return stored === 'breakfast' || stored === 'lunch' || stored === 'dinner' ? stored : 'dinner';
}

export async function setMealType(groupId: string, meal: MealType): Promise<void> {
  await AsyncStorage.setItem(mealKey(groupId), meal);
}

// TODO(backend): real join needs a security-definer RPC or Edge Function —
// RLS blocks non-members from reading flats by invite_code. Until then this
// always fails honestly rather than faking a membership.
export async function joinGroupByCode(_code: string): Promise<{ ok: false; reason: 'not-wired' }> {
  return { ok: false, reason: 'not-wired' };
}
```

- [ ] **Step 4: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/lib/meal-copy.ts src/lib/groups-stub.ts
git commit -m "Add meal types, meal copy helpers, and groups stub layer"
```

---

### Task 2: useMyGroups hook, ActiveGroupProvider, root redirect

**Files:**
- Create: `app/src/hooks/use-my-groups.ts`
- Create: `app/src/contexts/active-group.tsx`
- Modify: `app/src/app/_layout.tsx` (wrap Stack in provider)
- Modify: `app/src/app/index.tsx` (redirect on groups, not single flat)

**Interfaces:**
- Consumes: `getMealType`, `MEAL_ORDER`, `MealType` (Task 1)
- Produces: `GroupSummary { id: string; name: string; meal: MealType }`; `useMyGroups(session): { groups: GroupSummary[] | undefined; reload(): Promise<void> }`; `useActiveGroup(): { groups: GroupSummary[] | undefined; activeGroup: GroupSummary | null; setActiveGroupId(id: string): void; setGroupMeal(id: string, meal: MealType): Promise<void>; reloadGroups(): Promise<void> }`

- [ ] **Step 1: Create `app/src/hooks/use-my-groups.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';

import { getMealType } from '@/lib/groups-stub';
import { MEAL_ORDER } from '@/lib/meal-copy';
import { supabase } from '@/lib/supabase';
import type { MealType } from '@/types/domain';
import type { Session } from '@supabase/supabase-js';

export interface GroupSummary {
  id: string;
  name: string;
  meal: MealType;
}

// All groups the user belongs to (a group is a flats row — see the design
// doc). Replaces use-my-flat's single-membership assumption: the DB always
// allowed multiple flat_members rows per user; the app now uses them.
export function useMyGroups(session: Session | null | undefined) {
  const [groups, setGroups] = useState<GroupSummary[] | undefined>(undefined); // undefined = loading

  const reload = useCallback(async () => {
    if (session === undefined) return;
    if (session === null) {
      setGroups([]);
      return;
    }
    const { data } = await supabase
      .from('flat_members')
      .select('flat_id, flats(id, name)')
      .eq('user_id', session.user.id);
    const rows = data ?? [];
    const summaries = await Promise.all(
      rows.flatMap((row) => (row.flats ? [row.flats] : [])).map(async (flat) => ({
        id: flat.id,
        name: flat.name,
        meal: await getMealType(flat.id),
      }))
    );
    summaries.sort(
      (a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) || a.name.localeCompare(b.name)
    );
    setGroups(summaries);
  }, [session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { groups, reload };
}
```

Note: if the generated `database.ts` types make `row.flats` an array (Supabase sometimes types to-one joins as arrays), adjust with `const flat = Array.isArray(row.flats) ? row.flats[0] : row.flats;`.

- [ ] **Step 2: Create `app/src/contexts/active-group.tsx`**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useMyGroups, type GroupSummary } from '@/hooks/use-my-groups';
import { setMealType } from '@/lib/groups-stub';
import { useSession } from '@/hooks/use-session';
import type { MealType } from '@/types/domain';

interface ActiveGroupValue {
  groups: GroupSummary[] | undefined; // undefined = loading
  activeGroup: GroupSummary | null;
  setActiveGroupId: (id: string) => void;
  setGroupMeal: (id: string, meal: MealType) => Promise<void>;
  reloadGroups: () => Promise<void>;
}

const ActiveGroupContext = createContext<ActiveGroupValue | null>(null);

// Which of the user's groups the meal screens (Today, grocery list,
// who-is-eating, cook message preview) are scoped to. Defaults to the first
// group in meal order; selection is in-memory only.
export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { groups, reload } = useMyGroups(session);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const activeGroup = groups?.find((g) => g.id === activeGroupId) ?? groups?.[0] ?? null;

  const setGroupMeal = useCallback(
    async (id: string, meal: MealType) => {
      await setMealType(id, meal);
      await reload();
    },
    [reload]
  );

  return (
    <ActiveGroupContext.Provider
      value={{ groups, activeGroup, setActiveGroupId, setGroupMeal, reloadGroups: reload }}>
      {children}
    </ActiveGroupContext.Provider>
  );
}

export function useActiveGroup(): ActiveGroupValue {
  const value = useContext(ActiveGroupContext);
  if (!value) throw new Error('useActiveGroup must be used inside ActiveGroupProvider');
  return value;
}
```

- [ ] **Step 3: Wrap the Stack in `app/src/app/_layout.tsx`**

Import `ActiveGroupProvider` from `@/contexts/active-group` and wrap the existing `<Stack>` (keep `ThemeProvider` outermost):

```tsx
<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
  <ActiveGroupProvider>
    <Stack screenOptions={{ headerShown: false }}>
      {/* existing screens unchanged */}
    </Stack>
  </ActiveGroupProvider>
</ThemeProvider>
```

Also retitle the modal screens while here: `grocery-list` title stays "Grocery list"; `who-is-eating` title stays "Who's eating".

- [ ] **Step 4: Rewrite `app/src/app/index.tsx` redirect**

```tsx
import { Redirect } from 'expo-router';

import { useActiveGroup } from '@/contexts/active-group';
import { useSession } from '@/hooks/use-session';

export default function RootIndex() {
  const session = useSession();
  const { groups } = useActiveGroup();

  if (session === undefined || (session && groups === undefined)) {
    return null; // loading — TODO: splash/spinner
  }

  if (!session || !groups || groups.length === 0) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
```

- [ ] **Step 5: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean. (`use-my-flat.ts` still exists and is still used by screens — it is deleted in Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-my-groups.ts src/contexts/active-group.tsx src/app/_layout.tsx src/app/index.tsx
git commit -m "Add multi-group hook and active-group context; redirect on group membership"
```

---

### Task 3: Onboarding — profile screen and create/join chooser

**Files:**
- Modify: `app/src/app/onboarding/index.tsx` (tagline + route to profile)
- Create: `app/src/app/onboarding/profile.tsx` (display name + diet; content merged from `diet.tsx`)
- Create: `app/src/app/onboarding/choose.tsx`

**Interfaces:**
- Consumes: `useProfile(userId)` → `{ profile, updateProfile }` (existing); routes `/onboarding/create-group`, `/onboarding/join-group` (created in Task 4 — typecheck of route strings is not enforced until then if typed routes complain, temporarily point at existing routes only if needed; otherwise proceed).
- Produces: routes `/onboarding/profile`, `/onboarding/choose`.

- [ ] **Step 1: Update `app/src/app/onboarding/index.tsx`**

- Replace the tagline text `Vote in 5 seconds. Your cook gets clear instructions, automatically.` with `Build the next meal in 5 seconds. Your cook gets clear instructions, automatically.`
- In `ensureProfileThenContinue`, change `router.replace('/onboarding/create-flat')` to `router.replace('/onboarding/profile')`.
- Update the stale file comment: step 2 now lives in `onboarding/profile.tsx` → `onboarding/choose.tsx`; remove the reference to nonexistent `onboarding-phone.tsx` (keep the DLT note as prose).

- [ ] **Step 2: Create `app/src/app/onboarding/profile.tsx`**

Structure and styles copied from `diet.tsx` (same segmented diet row, Jain switch, allergy chips, bottom primary button), with these changes:

- Kicker: `About you` (replaces `Step 1 of 3`).
- Heading stays `what will you not eat?`; above the diet row add a display-name input.
- Display name `TextInput` placeholder `Your name`, initialized from `profile?.display_name ?? ''` via local state once profile loads (mount a child component with `key={profile?.id ?? 'loading'}` and `useState(profile?.display_name ?? '')`, same pattern as Settings' `CookSection`), saved with `updateProfile({ display_name: name.trim() })` on Next when non-empty and changed.
- The Next button navigates `router.push('/onboarding/choose')`.
- Diet/Jain/allergy handlers identical to `diet.tsx` (they write through `updateProfile`).

- [ ] **Step 3: Create `app/src/app/onboarding/choose.tsx`**

Same SafeArea/container/style conventions as the other onboarding screens. Content:

- Kicker: `Your household`
- Heading: `set up your group`
- Body: `One group = one meal, one cook. A household can run several — breakfast and dinner can be different groups.`
- Two pressable cards (`backgroundElement` ThemedView, `Radius.md`, padded):
  - **Create a group** / small text `You pick the meal and set up the cook.` → `router.push('/onboarding/create-group')`
  - **Join with a code** / small text `Someone in your household sent you an invite code.` → `router.push('/onboarding/join-group')`

- [ ] **Step 4: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean, except possibly typed-route errors for `/onboarding/create-group` / `/onboarding/join-group` if Expo's typed routes are enabled — if so, create empty placeholder files for those two routes now (they are fully written in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/app/onboarding/index.tsx src/app/onboarding/profile.tsx src/app/onboarding/choose.tsx
git commit -m "Split user onboarding from household setup: profile screen + create/join chooser"
```

---

### Task 4: Onboarding — create group, join group, cook step; delete old screens

**Files:**
- Create: `app/src/app/onboarding/create-group.tsx` (successor of `create-flat.tsx`)
- Create: `app/src/app/onboarding/join-group.tsx`
- Modify: `app/src/app/onboarding/cook.tsx` (group id via route param, copy sweep)
- Delete: `app/src/app/onboarding/create-flat.tsx`, `app/src/app/onboarding/diet.tsx`, `app/src/app/onboarding/limits.tsx`

**Interfaces:**
- Consumes: `useActiveGroup().reloadGroups/setActiveGroupId` (Task 2), `setMealType`, `joinGroupByCode` (Task 1), `mealLabel`, `MEAL_ORDER` (Task 1).
- Produces: route `/onboarding/create-group` (also reused by Settings' "Add group" in Task 7); `cook.tsx` accepts `useLocalSearchParams<{ groupId?: string }>`.

- [ ] **Step 1: Create `app/src/app/onboarding/create-group.tsx`**

Based on `create-flat.tsx`'s insert logic, with meal picker and stub write:

- Kicker `Your household`, heading `create your group`, body `One group = one meal, one cook. Add more groups later from Settings.`
- Name `TextInput` placeholder `Group name (e.g. "2BHK dinner")`.
- Meal picker: three chips from `MEAL_ORDER` rendered with `mealLabel`, default selected `'dinner'`, same selected-chip styling as diet chips.
- `createGroup()`:
  1. `supabase.auth.getUser()` → error state `Not signed in` if missing (same as old screen).
  2. Insert `flats` row `{ name, created_by: userId }`, select `id`.
  3. Insert `flat_members` `{ flat_id, user_id: userId, role: 'admin' }`.
  4. `await setMealType(flat.id, meal)` — stub write.
  5. `await reloadGroups(); setActiveGroupId(flat.id);`
  6. `router.push({ pathname: '/onboarding/cook', params: { groupId: flat.id } })`.
- Error handling identical in shape to `create-flat.tsx` (surface `error.message` under the button; reset loading).

- [ ] **Step 2: Create `app/src/app/onboarding/join-group.tsx`**

- Kicker `Your household`, heading `join a group`, body `Paste the invite code a group member sent you.`
- Code `TextInput` (autoCapitalize `characters`, placeholder `Invite code`), primary button `Join` disabled while empty/loading.
- On submit: `setLoading(true); const result = await joinGroupByCode(code.trim()); setLoading(false);` — since the stub always returns `{ ok: false, reason: 'not-wired' }`, show a dashed-border hint card (same style as onboarding hints):
  `Joining isn't wired up in this build yet — ask whoever invited you to add you from their side, or create your own group for now.`
- Below the error, a secondary (outline) button `Create a group instead` → `router.replace('/onboarding/create-group')`.

- [ ] **Step 3: Update `app/src/app/onboarding/cook.tsx`**

- Read `const { groupId } = useLocalSearchParams<{ groupId?: string }>();` and prefer it over the hook: `const flatId = groupId ?? activeGroup?.id;` where `activeGroup` comes from `useActiveGroup()`. Remove `useMyFlat` import.
- Copy sweep: `Drag the other flatmates in` → `Drag the rest of the group in`; file comment updated (`flat` → `group`). Keep the `flatmeal.app/j/<code>` display but append ` (code: <invite_code>)`? No — replace the whole invite line: show `Invite code: <invite_code> — tap to copy` and copy **just the code** to the clipboard (the `/j/` URL is dead until join is wired; the design's honest-stub rule applies).
- `finish()` unchanged (`upsertCook` then `router.replace('/(tabs)')`).

- [ ] **Step 4: Delete replaced screens**

```bash
git rm src/app/onboarding/create-flat.tsx src/app/onboarding/diet.tsx src/app/onboarding/limits.tsx
```

Then grep for dangling references: `grep -rn "create-flat\|/onboarding/diet\|/onboarding/limits" src/` — the only expected hit is `settings.tsx`'s `handleLeaveFlat` redirect (`/onboarding/create-flat`); point it at `/onboarding/choose` (it is rewritten fully in Task 7 anyway).

- [ ] **Step 5: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/onboarding
git commit -m "Rebuild household onboarding: create-group with meal picker, stubbed join, per-group cook step"
```

---

### Task 5: Today tab — meal chips, active group scope, meal-dynamic copy

**Files:**
- Modify: `app/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useActiveGroup()` (Task 2), `mealTitle`, `mealMoment`, `mealNoun`, `mealLabel` (Task 1).

- [ ] **Step 1: Swap flat for active group**

- Replace `useMyFlat` with `const { groups, activeGroup, setActiveGroupId } = useActiveGroup();` and `const flatId = activeGroup?.id;` — `useTodayCart(flatId, session?.user.id)` and `useStreak(flatId)` are unchanged.
- Derive `const meal = activeGroup?.meal ?? 'dinner';`

- [ ] **Step 2: Meal chips row**

Above the header row, when `(groups?.length ?? 0) > 1`, render a chip row (reuse the existing `tabRow`/`tabOption` styles) with one chip per group: label `mealLabel(g.meal)`, selected when `g.id === activeGroup?.id`, `onPress={() => setActiveGroupId(g.id)}`. With one group, render nothing (screen identical to today).

- [ ] **Step 3: Meal-dynamic copy sweep in this file**

| Current string | New |
|---|---|
| `Dinner tonight` (header) | `{mealTitle(meal)}` |
| `{headcount} eating tonight` | `` `${headcount} eating ${mealMoment(meal)}` `` |
| `I'm out today` | unchanged (already meal-neutral) |
| `No poll yet today` | `` `No ${mealNoun(meal)} suggestions yet` `` |
| `Suggestions land at your flat's poll-open time.` | `Suggestions land at your group's poll-open time.` |
| Empty-lock: `Take a safe fallback for tonight, or skip dinner altogether.` | `` `Take a safe fallback, or skip ${mealNoun(meal)} altogether.` `` |
| Empty-lock button `No dinner tonight` | `` `No ${mealNoun(meal)} ${mealMoment(meal)}` `` |

`EmptyCartAtLock` gains a `meal: MealType` prop passed from the parent. Everything else on the screen (locked card, activity feed, search modal, limit warning) is already meal-neutral.

- [ ] **Step 4: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "Scope Today to the active group with meal switcher chips and meal-dynamic copy"
```

---

### Task 6: Grocery list, who-is-eating, cook message preview — group scope + copy

**Files:**
- Modify: `app/src/app/grocery-list.tsx`
- Modify: `app/src/app/who-is-eating.tsx`
- Modify: `app/src/app/cook-message-preview.tsx`

**Interfaces:**
- Consumes: `useActiveGroup()` (Task 2), `mealShareHeading`, `mealNoun` (Task 1).

- [ ] **Step 1: `grocery-list.tsx`**

- Replace `useMyFlat` with `useActiveGroup()`; `flatId = activeGroup?.id`; `meal = activeGroup?.meal ?? 'dinner'`.
- Share text heading: `` `🛒 Tonight: ${data.dishSummary}` `` → `` `${mealShareHeading(meal)} ${data.dishSummary}` ``.
- Empty state body `This shows up once something's in tonight's cart.` → `` `This shows up once something's in the ${mealNoun(meal)} cart.` ``

- [ ] **Step 2: `who-is-eating.tsx`**

- Replace `useMyFlat` with `useActiveGroup()`.
- `No flat yet` → `No group yet`.
- File comment: "any OTHER flatmate" wording may stay (code comment, not UI), but update `flat member` → `group member` while touching it.
- Bottom CTA `Pick the main course` → `Back to the cart` (it just calls `router.back()` and lies whenever mains are picked or the cart is locked).

- [ ] **Step 3: `cook-message-preview.tsx`**

- Replace `useMyFlat` with `useActiveGroup()`.
- Empty state body `This shows up once tonight's poll has closed and a cook is set in Settings.` → `` `This shows up once the ${mealNoun(meal)} cart locks and a cook is set in Settings.` ``

- [ ] **Step 4: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/grocery-list.tsx src/app/who-is-eating.tsx src/app/cook-message-preview.tsx
git commit -m "Scope grocery, attendance, and cook preview screens to the active group"
```

---

### Task 7: Settings — "My groups" cards, add group, leave with confirmation

**Files:**
- Modify: `app/src/app/(tabs)/settings.tsx`
- Delete: `app/src/hooks/use-my-flat.ts` (last consumer removed here)

**Interfaces:**
- Consumes: `useActiveGroup()` (Task 2), `useFlatSettings(groupId)` (existing, name kept — it maps to DB tables), `mealLabel`, `MEAL_ORDER` (Task 1), `setGroupMeal` from context.

- [ ] **Step 1: Restructure the screen**

- Keep "My dietary profile" and "Send feedback" sections as they are.
- Replace the "Flat" section, `CookSection` mount, and the danger section with:
  - Section heading `My groups`.
  - `{groups?.map((g) => <GroupCard key={g.id} group={g} userId={session?.user.id} />)}`
  - An outline button `Add group` → `router.push('/onboarding/create-group')`.

- [ ] **Step 2: `GroupCard` component (same file)**

Each card calls `useFlatSettings(group.id)` itself (one component instance per group — no hook-in-loop). Card contents, top to bottom, using existing section styles:

1. Group name (`smallBold`) + meal chips: three chips (`mealLabel` over `MEAL_ORDER`), selected = `group.meal`, `onPress={() => setGroupMeal(group.id, m)}` (from `useActiveGroup()`).
2. `Invite code: {flat.invite_code}` + poll timings line (existing format) + `Members: …` line (all as in the current Flat section).
3. Soft limits (relocated from deleted `onboarding/limits.tsx`): two stepper rows — `Main courses per meal` bound to `flat.max_mains`, `Accompaniments & sides` bound to `flat.max_accompaniments` — each +/- writes `updateFlat({ max_mains: … })` / `updateFlat({ max_accompaniments: … })`, floor 1. Reuse the small 28px round stepper-button styles from the deleted limits screen.
4. The existing `CookSection` (unchanged component) mounted with this group's `cook` and `upsertCook`.
5. Leave control with inline two-step confirmation (works on web, unlike `Alert.alert`): initial state a danger-text button `Leave group`; pressing it swaps the row to `Leave {flat.name}? [Cancel] [Leave]` where **Leave** runs `await leaveFlat(userId); await reloadGroups();` and, if that was the last group, `router.replace('/onboarding/choose')`.

- [ ] **Step 3: Delete `app/src/hooks/use-my-flat.ts`**

```bash
git rm src/hooks/use-my-flat.ts
grep -rn "use-my-flat\|useMyFlat" src/   # expected: no hits
```

- [ ] **Step 4: Verify**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "Rebuild Settings around per-group cards with meal, limits, cook, and confirmed leave"
```

---

### Task 8: Copy sweep, e2e selector repair, final verification

**Files:**
- Modify: any file the sweep catches; `app/e2e/tests/*.spec.ts` and `app/e2e/fixtures/*` where text selectors reference changed copy.

- [ ] **Step 1: Sweep for leftover "flat" in UI strings**

```bash
grep -rn "flat" src/app src/components --include="*.tsx" -i | grep -v "flat_id\|flatId\|FlatSettings\|flat_members\|flats\|flat_note"
```

Every remaining hit must be either a DB identifier or a code comment; fix any user-visible string (expected stragglers: `who-is-eating.tsx` fallback member name `'Flatmate'` in `use-flat-settings.ts` → `'Member'`, `use-attendance.ts` if it has similar copy).

- [ ] **Step 2: Repair e2e text selectors (do not run the suite)**

```bash
grep -rn "Dinner tonight\|create-flat\|Create flat\|eating tonight\|No poll yet\|Pick the main course\|Tonight:" e2e/
```

Update matched selectors to the new copy (`mealTitle('dinner')` = `Dinner tonight` is unchanged for dinner groups — most selectors survive; the onboarding specs that drive `create-flat` need the new route/labels: profile → choose → create-group). Leave a `// NOTE: suite not run in this pass — no configured runner env` comment at the top of any spec file whose flow was edited blind.

- [ ] **Step 3: Full verification gate**

Run from `/app`: `npx tsc --noEmit && npx expo lint`
Expected: both clean.

Manual flow check (web, `npx expo start` → `w`), from the design doc: fresh onboarding → profile → choose → create group with meal picker → cook → Today shows meal-correct copy; add a second group from Settings → chips appear and switch scope; grocery share heading is meal-aware; leave group asks for confirmation; join screen shows the honest stub message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Sweep remaining flat copy and repair e2e selectors for the groups model"
```

---

## Self-review

- **Spec coverage:** onboarding split (T3), create/join chooser (T3/T4), groups replace flats + per-group cook/timings/cart (T2/T5/T6/T7), meal-dynamic copy (T1/T5/T6/T8), stub layer (T1), limits relocation (T7), leave confirmation (T7), honest join stub (T4), tagline fix (T3). No spec section uncovered.
- **Type consistency:** `MealType` defined once in `domain.ts`; `GroupSummary` in `use-my-groups.ts`; context API names (`activeGroup`, `setActiveGroupId`, `setGroupMeal`, `reloadGroups`) used identically in T4–T7.
- **Placeholders:** the two TODOs in `groups-stub.ts` are deliberate product stubs required by the spec, not plan gaps.
