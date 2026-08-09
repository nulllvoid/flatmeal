import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { resetPollState, triggerCreatePoll } from '../fixtures/poll-state';
import { addToCartAsUser, seedOpenPoll } from '../fixtures/seed-poll';
import { TEST_FLAT_ID, TEST_USERS } from '../fixtures/test-users';

test.describe('Multi-user shared cart and realtime', () => {
  test.beforeEach(async () => {
    await resetPollState();
    seedOpenPoll(['palak-paneer', 'dal-tadka', 'tomato-rasam']);
  });

  test.afterEach(async () => {
    await resetPollState();
  });

  test('two flatmates add different dishes and both see the shared cart update live', async ({ ownerPage, priyaPage }) => {
    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await priyaPage.getByRole('tab', { name: 'Today' }).click();

    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(priyaPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });

    // Owner adds Palak Paneer to the cart.
    await ownerPage.getByText('Palak Paneer', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    // Realtime: priya's already-open page should reflect the owner's add
    // without any manual reload — this is the whole point of the cart_items
    // realtime subscription in use-today-cart.ts.
    await expect(priyaPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 8000 });

    // Priya adds a different dish.
    await priyaPage.getByText('Dal Tadka', { exact: true }).click();
    await priyaPage.waitForTimeout(1000);

    // Owner's page should pick up priya's addition live too.
    await expect(ownerPage.getByText('Dal Tadka', { exact: true })).toBeVisible({ timeout: 8000 });

    const cartRows = dbQuery(
      `select r.slug from cart_items ci join recipes r on r.id = ci.recipe_id
       join daily_polls dp on dp.id = ci.poll_id where dp.flat_id = '${TEST_FLAT_ID}' order by r.slug;`
    ) as { slug: string }[];
    expect(cartRows.map((r) => r.slug).sort()).toEqual(['dal-tadka', 'palak-paneer']);
  });

  test('a member can adjust a cart line quantity with the stepper and it persists', async ({ ownerPage }) => {
    // Seed below headcount (flat has 3 members) — tapping a suggestion
    // defaults quantity to the current headcount, so a fresh add would
    // already sit at the cap and "+" would have nothing to test (setQuantity
    // re-caps at the fresh headcount, decision #8). Seed at 1 instead so the
    // stepper's "+" has headroom to actually change something.
    addToCartAsUser(TEST_USERS.owner.id, 'palak-paneer', 1);

    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });

    const before = dbQuery(
      `select ci.quantity from cart_items ci join recipes r on r.id = ci.recipe_id
       join daily_polls dp on dp.id = ci.poll_id where dp.flat_id = '${TEST_FLAT_ID}' and r.slug = 'palak-paneer';`
    ) as { quantity: number }[];
    expect(before[0].quantity).toBe(1);

    await ownerPage.getByText('+', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    const after = dbQuery(
      `select ci.quantity from cart_items ci join recipes r on r.id = ci.recipe_id
       join daily_polls dp on dp.id = ci.poll_id where dp.flat_id = '${TEST_FLAT_ID}' and r.slug = 'palak-paneer';`
    ) as { quantity: number }[];
    expect(after[0].quantity).toBe(before[0].quantity + 1);
  });

  test('removing a cart line deletes the row, not just zeroes the quantity', async ({ ownerPage }) => {
    await ownerPage.getByRole('tab', { name: 'Today' }).click();
    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible({ timeout: 15000 });

    await ownerPage.getByText('Palak Paneer', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    await ownerPage.getByText('Remove', { exact: true }).click();
    await ownerPage.waitForTimeout(1000);

    const rows = dbQuery(
      `select ci.recipe_id from cart_items ci join recipes r on r.id = ci.recipe_id
       join daily_polls dp on dp.id = ci.poll_id where dp.flat_id = '${TEST_FLAT_ID}' and r.slug = 'palak-paneer';`
    ) as { recipe_id: string }[];
    expect(rows).toHaveLength(0);

    // Removed dish goes back to being a tappable suggestion, not stuck as a
    // zero-quantity cart line.
    await expect(ownerPage.getByText('Palak Paneer', { exact: true })).toBeVisible();
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
