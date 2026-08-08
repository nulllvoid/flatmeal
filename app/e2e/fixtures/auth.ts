import { test as base, type Page } from '@playwright/test';

import { mintSession, PROJECT_REF, type TestUserKey } from './test-users';

// Extends Playwright's `test` with one authenticated page per flatmate,
// each in its own isolated BrowserContext (own localStorage, own cookies)
// so concurrent multi-user scenarios — e.g. two flatmates voting at once —
// use genuinely separate sessions, not one page juggling auth swaps.
//
// A session is injected into localStorage under Supabase's own storage key
// *before* the app's JS runs (via addInitScript), then the page navigates —
// this mirrors how a real returning user's session is picked up on load,
// without ever driving the (broken, in this environment) magic-link email
// flow. See e2e/README.md "Why forged sessions".
interface AuthFixtures {
  ownerPage: Page;
  priyaPage: Page;
  rahulPage: Page;
}

async function authenticatedPage(
  { browser, baseURL }: { browser: import('@playwright/test').Browser; baseURL?: string },
  userKey: TestUserKey
): Promise<Page> {
  const session = mintSession(userKey);
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const storageKey = `sb-${PROJECT_REF}-auth-token`;

  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session }
  );

  const page = await context.newPage();
  await page.goto(baseURL ?? 'http://localhost:8081', { waitUntil: 'domcontentloaded' });
  // Expo web's first mount + Supabase session hydration takes a beat;
  // callers should still `waitFor` the specific element they need, this
  // just avoids racing the earliest paint.
  await page.waitForTimeout(2000);
  return page;
}

export const test = base.extend<AuthFixtures>({
  ownerPage: async ({ browser, baseURL }, use) => {
    const page = await authenticatedPage({ browser, baseURL }, 'owner');
    await use(page);
    await page.close();
  },
  priyaPage: async ({ browser, baseURL }, use) => {
    const page = await authenticatedPage({ browser, baseURL }, 'priya');
    await use(page);
    await page.close();
  },
  rahulPage: async ({ browser, baseURL }, use) => {
    const page = await authenticatedPage({ browser, baseURL }, 'rahul');
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
