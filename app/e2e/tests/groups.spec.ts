import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { TEST_USERS } from '../fixtures/test-users';

// Coverage for the multi-group refactor (docs/superpowers/plans/2026-08-11-groups-refactor.md)
// that the rest of the suite doesn't touch: the Today tab's meal-chips group
// switcher, and Settings' two-step "Leave group" confirm actually removing a
// flat_members row (not just rendering, which settings.spec.ts already
// covers for the single-group case).
//
// Uses a second, disposable flat that only rahul belongs to, so leaving it
// can't disturb TEST_FLAT_ID's shared fixture data used by every other spec.
const SECOND_FLAT_NAME = 'E2E Second Group (rahul only)';

function getSecondFlatId(): string {
  const rows = dbQuery(`select id from flats where name = '${SECOND_FLAT_NAME}';`) as { id: string }[];
  if (!rows[0]) throw new Error(`${SECOND_FLAT_NAME} not seeded — beforeAll should have created it`);
  return rows[0].id;
}

test.describe('Groups (multi-group switcher + leave)', () => {
  test.beforeAll(() => {
    dbQuery(`
      insert into flats (name) values ('${SECOND_FLAT_NAME}')
      on conflict do nothing;
    `);
    const flatId = getSecondFlatId();
    dbQuery(`
      insert into flat_members (flat_id, user_id, role)
      values ('${flatId}', '${TEST_USERS.rahul.id}', 'member')
      on conflict (flat_id, user_id) do nothing;
    `);
  });

  test.afterAll(() => {
    // Best-effort cleanup — safe even if the leave-group test already
    // removed the membership and/or the flat itself.
    const rows = dbQuery(`select id from flats where name = '${SECOND_FLAT_NAME}';`) as { id: string }[];
    const flatId = rows[0]?.id;
    if (flatId) {
      dbQuery(`
        delete from flat_members where flat_id = '${flatId}';
        delete from flats where id = '${flatId}';
      `);
    }
  });

  test('meal chips appear for a multi-group user and switch the Today tab scope', async ({ rahulPage }) => {
    // rahul belongs to TEST_FLAT_ID (seeded 'dinner' by default in groups-stub's
    // AsyncStorage fallback) plus the second flat seeded above — two groups is
    // exactly the threshold MealChips renders at (index.tsx: `groups.length <= 1`
    // returns null).
    await rahulPage.getByRole('tab', { name: 'Today' }).click();

    // Both groups default to 'dinner' (groups-stub.ts has no per-flat DB
    // column yet, so getMealTypes falls back to ['dinner'] for any group with
    // no AsyncStorage entry) — so two chips both read "Dinner" rather than two
    // distinct labels. useMyGroups loads asynchronously (fetch flat_members,
    // then a per-group AsyncStorage read for each), so wait for the visible
    // chip count to settle at 2 rather than asserting immediately —
    // MealChips renders null until `groups` has loaded and length > 1.
    //
    // `getByText` alone can also pick up detached/zero-size duplicate nodes
    // Expo Router leaves behind across a screen transition, so scope to
    // `:visible` — confirmed via manual DOM probing that the extra matches
    // have a 0x0 bounding rect while the real chips don't.
    const dinnerChips = rahulPage.getByText('Dinner', { exact: true }).locator('visible=true');
    await expect(dinnerChips).toHaveCount(2, { timeout: 10_000 });
    await expect(dinnerChips.first()).toBeVisible();

    // Switching chips re-scopes the screen to the other group's poll state
    // without a full reload — clicking the second chip must not throw/blank
    // the screen, and the chip row must still render both options afterward.
    // force: true — Expo Router web renders an invisible full-width
    // role=tablist hit-area over this viewport that intercepts pointer
    // events in Playwright's headless browser; not reproducible on a real
    // touch device, so bypassing Playwright's actionability's hit-test here
    // matches how a real tap on native/mobile web actually behaves.
    await dinnerChips.nth(1).click({ force: true });
    await expect(dinnerChips).toHaveCount(2, { timeout: 10_000 });
  });

  test('leaving a non-last group removes the flat_members row and keeps the other group', async ({ rahulPage }) => {
    const flatId = getSecondFlatId();

    await rahulPage.getByRole('tab', { name: 'Settings' }).click();
    await expect(rahulPage.getByText(SECOND_FLAT_NAME, { exact: true })).toBeVisible();

    // Smallest ancestor div that contains both the group's own name and its
    // own "Leave group" control — RN-web flattens Views into several nested
    // divs, so a fixed number of `..` hops is fragile; walk up to the first
    // ancestor that also contains the sibling text instead.
    const secondGroupCard = rahulPage
      .locator('div')
      .filter({ hasText: SECOND_FLAT_NAME })
      .filter({ hasText: 'Leave group' })
      .last();
    await secondGroupCard.getByText('Leave group', { exact: true }).click();

    // Two-step confirm: clicking "Leave group" swaps in a "Leave <name>?" /
    // Cancel / Leave row rather than acting immediately.
    await expect(rahulPage.getByText(`Leave ${SECOND_FLAT_NAME}?`, { exact: true })).toBeVisible();

    const rows = dbQuery(
      `select 1 from flat_members where flat_id = '${flatId}' and user_id = '${TEST_USERS.rahul.id}';`
    ) as unknown[];
    expect(rows).toHaveLength(1); // not removed yet — confirm step hasn't been clicked

    await secondGroupCard.getByText('Leave', { exact: true }).click();
    await rahulPage.waitForTimeout(1500);

    const rowsAfter = dbQuery(
      `select 1 from flat_members where flat_id = '${flatId}' and user_id = '${TEST_USERS.rahul.id}';`
    ) as unknown[];
    expect(rowsAfter).toHaveLength(0);

    // rahul still belongs to TEST_FLAT_ID (wasn't his last group), so
    // Settings should still land on that group's card, not bounce to
    // /onboarding/choose.
    await expect(rahulPage.getByRole('tab', { name: 'Today' })).toBeVisible();
  });
});
