import { test, expect } from '../fixtures/auth';
import { dbQuery } from '../fixtures/db';
import { getPollForDate, resetPollState, triggerClosePoll, triggerDispatchCook } from '../fixtures/poll-state';
import { castAccompanimentVoteAsUser, castVoteAsUser, seedOpenPoll } from '../fixtures/seed-poll';
import { TEST_USERS } from '../fixtures/test-users';

// Covers the 5-state UI machine documented in app/src/app/(tabs)/index.tsx's
// accompaniment section: open (no section), closed+options (voting open),
// closed+zero-options (skip path, e.g. Vegetable Pulao), decided-not-yet-
// dispatched, and dispatched (combined name everywhere).
test.describe('Accompaniment (roti/rice) vote', () => {
  test.afterEach(async () => {
    await resetPollState();
  });

  test('state 1: open poll shows main-dish cards only, no accompaniment section', async ({ ownerPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await expect(ownerPage.getByText('Dal Tadka', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText('What should it come with?')).toHaveCount(0);
  });

  test('state 3: closing a poll for a dish with accompaniments opens a second vote', async ({ ownerPage, priyaPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']); // dal-tadka -> roti + steamed-rice
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    castVoteAsUser(TEST_USERS.priya.id, 'dal-tadka');

    await triggerClosePoll();

    const poll = getPollForDate() as { id: string; winner_recipe_id: string } | null;
    const winnerSlug = dbQuery(`select slug from recipes where id = '${poll?.winner_recipe_id}';`) as {
      slug: string;
    }[];
    expect(winnerSlug[0].slug).toBe('dal-tadka');

    const options = dbQuery(
      `select r.slug from poll_accompaniment_options pao join recipes r on r.id = pao.recipe_id
       where pao.poll_id = '${poll?.id}';`
    ) as { slug: string }[];
    expect(options.map((o) => o.slug).sort()).toEqual(['roti', 'steamed-rice']);

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await expect(ownerPage.getByText('What should it come with?')).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText('Roti', { exact: true })).toBeVisible();
    await expect(ownerPage.getByText('Steamed Rice', { exact: true })).toBeVisible();

    // Multi-user: priya votes for Roti and the owner's page reflects it
    // live via the accompaniment_votes realtime subscription.
    await priyaPage.reload();
    await priyaPage.waitForTimeout(3000);
    await priyaPage.getByText('Roti', { exact: true }).click();
    await priyaPage.waitForTimeout(1500);

    await expect(ownerPage.getByText(`vote — ${TEST_USERS.priya.displayName}`, { exact: false })).toBeVisible({
      timeout: 8000,
    });
  });

  test('state 2: a dish with no curated accompaniment (Vegetable Pulao) skips the vote entirely', async ({
    ownerPage,
  }) => {
    await resetPollState();
    seedOpenPoll(['veg-pulao', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'veg-pulao');
    castVoteAsUser(TEST_USERS.priya.id, 'veg-pulao');

    await triggerClosePoll();

    const poll = getPollForDate() as { winner_accompaniment_reason: string } | null;
    expect(poll?.winner_accompaniment_reason).toBe('none_available');

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await expect(ownerPage.getByText("Tonight's winner", { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText('Vegetable Pulao', { exact: true })).toBeVisible();
    // No accompaniment suffix, no voting section — the "skip cleanly" path.
    await expect(ownerPage.getByText('Vegetable Pulao with', { exact: false })).toHaveCount(0);
    await expect(ownerPage.getByText('What should it come with?')).toHaveCount(0);
  });

  test('state 5: after dispatch, the winner card shows the combined dish name', async ({ ownerPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();

    castAccompanimentVoteAsUser(TEST_USERS.owner.id, 'roti');

    await triggerDispatchCook();

    const poll = getPollForDate() as {
      status: string;
      winner_accompaniment_recipe_id: string;
      winner_accompaniment_reason: string;
    } | null;
    expect(poll?.status).toBe('dispatched');
    expect(poll?.winner_accompaniment_reason).toBe('votes');

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await expect(ownerPage.getByText('Dal Tadka with Roti', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText('What should it come with?')).toHaveCount(0);
  });

  test('grocery list and cook message both include the accompaniment after dispatch', async ({ ownerPage }) => {
    await resetPollState();
    seedOpenPoll(['dal-tadka', 'tomato-rasam']);
    castVoteAsUser(TEST_USERS.owner.id, 'dal-tadka');
    await triggerClosePoll();

    castAccompanimentVoteAsUser(TEST_USERS.owner.id, 'roti');
    await triggerDispatchCook();

    await ownerPage.reload();
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Grocery list', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    // Expo Router's tab navigator keeps the Today tab mounted-but-hidden
    // underneath, so a bare getByText('Dal Tadka with Roti') matches both
    // screens — scope to the "Scaled for" line, unique to the grocery
    // screen, and to the ingredient line for the atta check.
    await expect(ownerPage.getByText('Scaled for', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(ownerPage.getByText('Wheat flour (atta)', { exact: true })).toBeVisible();

    // grocery-list and cook-message-preview are pushed stack screens over
    // the tabs (see app/src/app/_layout.tsx), not sibling tabs — reload()
    // would just reload the current screen's URL, so re-enter from the
    // Today tab via a fresh navigation instead of trying to "go back".
    await ownerPage.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
    await ownerPage.waitForTimeout(3000);
    await ownerPage.getByText('Preview cook message', { exact: true }).click();
    await ownerPage.waitForTimeout(2000);

    await expect(ownerPage.getByText("Today's meal: Dal Tadka with Roti", { exact: false })).toBeVisible({
      timeout: 15000,
    });
    await expect(ownerPage.getByText('For the Roti:', { exact: false })).toBeVisible();
  });
});
