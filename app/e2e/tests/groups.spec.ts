import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { TEST_FLAT_ID, TEST_USERS } from '../fixtures/test-users';

// Coverage for the multi-group refactor (docs/superpowers/plans/2026-08-11-groups-refactor.md)
// that the rest of the suite doesn't touch: the Today tab's group-switcher
// chips (labeled by each group's own name — see (tabs)/index.tsx's
// MealChips), and Settings' two-step "Leave group" confirm actually
// removing a flat_members row (not just rendering, which settings.spec.ts
// already covers for the single-group case).
//
// Uses a second, disposable flat that only rahul belongs to, so leaving it
// can't disturb TEST_FLAT_ID's shared fixture data used by every other spec.
const SECOND_FLAT_NAME = 'E2E Second Group (rahul only)';

function getSecondFlatId(): string {
  const rows = dbQuery(`select id from flats where name = '${SECOND_FLAT_NAME}';`) as { id: string }[];
  if (!rows[0]) throw new Error(`${SECOND_FLAT_NAME} not seeded — beforeAll should have created it`);
  return rows[0].id;
}

function getTestFlatName(): string {
  const rows = dbQuery(`select name from flats where id = '${TEST_FLAT_ID}';`) as { name: string }[];
  return rows[0].name;
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

  test('group-switcher chips show each group\'s own name and switch the Today tab scope', async ({ rahulPage }) => {
    // rahul belongs to TEST_FLAT_ID plus the second flat seeded above — two
    // groups is exactly the threshold MealChips renders at (index.tsx:
    // `groups.length <= 1` returns null).
    const testFlatName = getTestFlatName();

    await rahulPage.getByRole('tab', { name: 'Today' }).click();

    // useMyGroups loads asynchronously (fetch flat_members, then a
    // per-group query), so wait for both chips to actually appear rather
    // than asserting immediately — MealChips renders null until `groups`
    // has loaded and length > 1.
    //
    // `getByText` alone can also pick up detached/zero-size duplicate nodes
    // Expo Router leaves behind across a screen transition, so scope to
    // `:visible` — confirmed via manual DOM probing that the extra matches
    // have a 0x0 bounding rect while the real chips don't.
    const testFlatChip = rahulPage.getByText(testFlatName, { exact: true }).locator('visible=true');
    const secondFlatChip = rahulPage.getByText(SECOND_FLAT_NAME, { exact: true }).locator('visible=true');
    await expect(testFlatChip).toBeVisible({ timeout: 10_000 });
    await expect(secondFlatChip).toBeVisible({ timeout: 10_000 });

    // Switching chips re-scopes the screen to the other group's poll state
    // without a full reload — clicking the second chip must not throw/blank
    // the screen, and both chips must still render afterward.
    // force: true — Expo Router web renders an invisible full-width
    // role=tablist hit-area over this viewport that intercepts pointer
    // events in Playwright's headless browser; not reproducible on a real
    // touch device, so bypassing Playwright's actionability's hit-test here
    // matches how a real tap on native/mobile web actually behaves.
    await secondFlatChip.click({ force: true });
    await expect(testFlatChip).toBeVisible({ timeout: 10_000 });
    await expect(secondFlatChip).toBeVisible({ timeout: 10_000 });
  });

  test('leaving a non-last group removes the flat_members row and keeps the other group', async ({ rahulPage }) => {
    const flatId = getSecondFlatId();

    await rahulPage.getByRole('tab', { name: 'Settings' }).click();
    // Scoped to the Settings tabpanel — Expo Router keeps the Today tab's
    // group-switcher chips mounted in the background (getByLabel('Today')),
    // and since chips are now labeled by group name too (same as this
    // group's Settings card), an unscoped locator hits both.
    const settingsPanel = rahulPage.getByLabel('Settings', { exact: true });
    await expect(settingsPanel.getByText(SECOND_FLAT_NAME, { exact: true })).toBeVisible();

    // Smallest ancestor div that contains both the group's own name and its
    // own "Leave group" control — RN-web flattens Views into several nested
    // divs, so a fixed number of `..` hops is fragile; walk up to the first
    // ancestor that also contains the sibling text instead.
    const secondGroupCard = settingsPanel
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
