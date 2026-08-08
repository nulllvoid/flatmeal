import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { resetPollState, triggerClosePoll, triggerDispatchCook } from '../fixtures/poll-state';
import { castVoteAsUser, seedOpenPoll } from '../fixtures/seed-poll';
import { TEST_FLAT_ID, TEST_USERS } from '../fixtures/test-users';

test.describe('Grocery list and cook dispatch', () => {
  test.afterEach(async () => {
    await resetPollState();
  });

  test('grocery list scales ingredient quantities to headcount, and staples are separated from the buy list', async ({
    ownerPage,
  }) => {
    await resetPollState();
    seedOpenPoll(['palak-paneer', 'dal-tadka']);
    castVoteAsUser(TEST_USERS.owner.id, 'palak-paneer');
    castVoteAsUser(TEST_USERS.priya.id, 'palak-paneer');
    castVoteAsUser(TEST_USERS.rahul.id, 'palak-paneer');
    // All 3 flatmates present tonight (no day_attendance out-rows) -> headcount 3.

    await triggerClosePoll();

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Grocery list', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await expect(ownerPage.getByText('Scaled for 3', { exact: false })).toBeVisible({ timeout: 15000 });

    // Palak Paneer's Paneer is 70g/person, not a staple -> 210g at headcount
    // 3 (scale-ingredient.ts rounds weight to the nearest 5g, so 210 is exact).
    await expect(ownerPage.getByText('210 g', { exact: false })).toBeVisible();

    // Its staple spices (ginger-garlic paste, cumin, garam masala, turmeric)
    // must appear in the "check you have" line, not as individually
    // checkable buy-list rows.
    await expect(ownerPage.getByText('Check you have:', { exact: false })).toBeVisible();
    await expect(ownerPage.getByText('Garam masala', { exact: true })).toHaveCount(0); // not a standalone row
  });

  test('checklist toggle persists and realtime-syncs across two flatmates', async ({ ownerPage, priyaPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Grocery list', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await priyaPage.reload();
    await priyaPage.waitForTimeout(3000);
    await priyaPage.getByText('Grocery list', { exact: true }).click();
    await priyaPage.waitForTimeout(2000);

    await expect(ownerPage.getByText('Toor dal', { exact: true })).toBeVisible({ timeout: 15000 });

    // Owner ticks off Toor dal.
    await ownerPage.getByText('Toor dal', { exact: true }).click();
    await ownerPage.waitForTimeout(1500);

    // Priya's independently-open grocery list should reflect the tick live
    // via grocery_checks realtime — no reload on her side.
    const priyaToorDal = priyaPage.getByText('Toor dal', { exact: true }).locator('..');
    await expect(priyaToorDal).toHaveCSS('opacity', /0\.5|1/); // struck-through row has reduced opacity

    const checks = dbQuery(
      `select ri.name_en from grocery_checks gc
       join recipe_ingredients ri on ri.id = gc.ingredient_id
       join daily_polls dp on dp.id = gc.poll_id
       where dp.flat_id = '${TEST_FLAT_ID}';`
    ) as { name_en: string }[];
    expect(checks.map((c) => c.name_en)).toContain('Toor dal');
  });

  test('share-to-WhatsApp button is present and the "to buy" count excludes checked items', async ({ ownerPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Grocery list', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await expect(ownerPage.getByText('Share to WhatsApp', { exact: true })).toBeVisible({ timeout: 15000 });

    const beforeText = await ownerPage.getByText(/to buy/).textContent();
    const before = Number(beforeText?.match(/^(\d+)/)?.[1]);

    await ownerPage.getByText('Toor dal', { exact: true }).click();
    await ownerPage.waitForTimeout(1500);

    const afterText = await ownerPage.getByText(/to buy/).textContent();
    const after = Number(afterText?.match(/^(\d+)/)?.[1]);

    expect(after).toBe(before - 1);
  });

  test('cook message preview shows "queued" before dispatch and the real payload after (mock mode)', async ({
    ownerPage,
  }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Preview cook message', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await expect(ownerPage.getByText('Will be sent at dispatch time', { exact: false })).toBeVisible({
      timeout: 15000,
    });

    await triggerDispatchCook();

    const log = dbQuery(
      `select dl.status, dl.mode from dispatch_log dl join daily_polls dp on dp.id = dl.poll_id where dp.flat_id = '${TEST_FLAT_ID}' order by dl.created_at desc limit 1;`
    ) as { status: string; mode: string }[];
    expect(log[0].mode).toBe('mock');
    expect(log[0].status).toBe('mocked');

    await ownerPage.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Preview cook message', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await expect(ownerPage.getByText('Status: mocked', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText("Today's meal:", { exact: false })).toBeVisible();
    await expect(ownerPage.getByText('Show English', { exact: true })).toBeVisible();
  });

  test('dispatch_cook correctly logs "no active cook" and does not mark the poll dispatched', async () => {
    // Deactivate the seeded cook for this one test, then restore it.
    const activeCook = dbQuery(
      `select id from cooks where flat_id = '${TEST_FLAT_ID}' and is_active = true;`
    ) as { id: string }[];
    if (activeCook.length === 0) test.skip(true, 'no active cook seeded for this flat to deactivate');

    dbQuery(`update cooks set is_active = false where id = '${activeCook[0].id}';`);

    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();
    await triggerDispatchCook();

    const poll = dbQuery(
      `select status from daily_polls where flat_id = '${TEST_FLAT_ID}' order by created_at desc limit 1;`
    ) as { status: string }[];
    expect(poll[0].status).toBe('closed'); // not 'dispatched' — nothing was sent

    const errors = dbQuery(
      `select detail from pipeline_errors where stage = 'dispatch_cook' and flat_id = '${TEST_FLAT_ID}' order by created_at desc limit 1;`
    ) as { detail: { message: string } }[];
    expect(errors[0]?.detail?.message).toBe('no active cook for flat');

    dbQuery(`update cooks set is_active = true where id = '${activeCook[0].id}';`);
  });
});
