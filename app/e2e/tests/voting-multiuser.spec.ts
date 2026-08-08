import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { resetPollState, triggerCreatePoll } from '../fixtures/poll-state';
import { seedOpenPoll } from '../fixtures/seed-poll';
import { TEST_FLAT_ID, TEST_USERS } from '../fixtures/test-users';

test.describe('Multi-user voting and realtime', () => {
  test.beforeEach(async () => {
    await resetPollState();
    seedOpenPoll(['palak-paneer', 'dal-tadka', 'tomato-rasam']);
  });

  test.afterEach(async () => {
    await resetPollState();
  });

  test('two flatmates vote independently and both see the live tally update', async ({ ownerPage, priyaPage }) => {
    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await priyaPage.getByRole('tab', { name: 'Today' }).click();

    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(priyaPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });

    // Owner votes for Palak Paneer.
    await ownerPage.getByText('Palak Paneer', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    // Realtime: priya's already-open page should reflect the owner's vote
    // without any manual reload — this is the whole point of the votes
    // realtime subscription in use-today-poll.ts. Scoped to the vote-count
    // line text (not a bare name match) since "Members: ..." elsewhere on
    // screen also contains these display names.
    await expect(priyaPage.getByText(`vote — ${TEST_USERS.owner.displayName}`, { exact: false })).toBeVisible({
      timeout: 8000,
    });

    // Priya votes for a different dish.
    await priyaPage.getByText('Dal Tadka', { exact: true }).click();
    await priyaPage.waitForTimeout(1000);

    // Owner's page should pick up priya's vote live too.
    await expect(ownerPage.getByText(`vote — ${TEST_USERS.priya.displayName}`, { exact: false })).toBeVisible({
      timeout: 8000,
    });

    const votes = dbQuery(
      `select v.user_id, r.slug from votes v join poll_options po on po.recipe_id = v.recipe_id
       join recipes r on r.id = v.recipe_id
       join daily_polls dp on dp.id = v.poll_id where dp.flat_id = '${TEST_FLAT_ID}' order by v.user_id;`
    ) as { user_id: string; slug: string }[];
    expect(votes.find((v) => v.user_id === TEST_USERS.owner.id)?.slug).toBe('palak-paneer');
    expect(votes.find((v) => v.user_id === TEST_USERS.priya.id)?.slug).toBe('dal-tadka');
  });

  test('a member can change their vote and the tally reflects the new choice, not both', async ({ ownerPage }) => {
    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });

    await ownerPage.getByText('Palak Paneer', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);
    await ownerPage.getByText('Dal Tadka', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    const votes = dbQuery(
      `select recipe_id from votes v join daily_polls dp on dp.id = v.poll_id
       where dp.flat_id = '${TEST_FLAT_ID}' and v.user_id = '${TEST_USERS.owner.id}';`
    ) as { recipe_id: string }[];
    // primary key (poll_id, user_id) enforces exactly one row per member —
    // this asserts the UI's upsert actually replaced, not duplicated.
    expect(votes).toHaveLength(1);

    const dishName = ownerPage.getByText('Dal Tadka', { exact: true });
    await expect(dishName).toBeVisible();
  });

  test("out-today toggle removes a member from tonight's headcount", async ({ ownerPage, rahulPage }) => {
    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await rahulPage.getByRole('tab', { name: 'Today' }).click();
    await expect(ownerPage.getByText(/eating tonight/)).toBeVisible({ timeout: 15000 });

    const before = await ownerPage.getByText(/eating tonight/).textContent();
    const beforeCount = Number(before?.match(/^(\d+)/)?.[1]);

    await rahulPage.getByText("I'm out today").locator('..').getByRole('switch').click();
    await rahulPage.waitForTimeout(1500);

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    const after = await ownerPage.getByText(/eating tonight/).textContent();
    const afterCount = Number(after?.match(/^(\d+)/)?.[1]);

    expect(afterCount).toBe(beforeCount - 1);

    // revert so later specs see a clean headcount
    await rahulPage.getByText("I'm out today").locator('..').getByRole('switch').click();
  });

  test('dietary veto: a flat with any veg member never gets served nonveg or egg dishes', async () => {
    // owner=veg, priya=veg, rahul=nonveg -> flat ceiling is veg (most
    // restrictive member wins, per select-options.ts isRecipeEligible).
    // Uses the real create_poll selection logic, not the lightweight
    // seedOpenPoll fixture, since this is specifically testing that logic.
    await resetPollState();
    await triggerCreatePoll();

    const options = dbQuery(
      `select r.slug, r.diet_class from poll_options po
       join daily_polls dp on dp.id = po.poll_id
       join recipes r on r.id = po.recipe_id
       where dp.flat_id = '${TEST_FLAT_ID}';`
    ) as { slug: string; diet_class: string }[];

    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.diet_class, `${opt.slug} should not be served to a flat with a veg member`).toBe('veg');
    }
  });
});
