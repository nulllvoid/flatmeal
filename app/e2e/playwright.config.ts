import { defineConfig } from '@playwright/test';

// Runs against the real deployed Supabase project (pcmtsfcjzoivagpslpch),
// same as manual testing throughout the feature-build session — there is no
// mocked backend. Tests are inherently sequential-ish in effect (they share
// TEST_FLAT_ID's poll state), so fullyParallel is off and workers is 1;
// see e2e/README.md "Why serial".
export default defineConfig({
  testDir: './tests',
  // Generous default: each dbQuery() fixture call shells out to `supabase
  // db query`, and heavier scenarios chain several of those plus multiple
  // page reloads — routinely 60-90s for the multi-user/dispatch specs.
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { outputFolder: '../e2e-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 420, height: 900 },
  },
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 60_000,
    cwd: '..',
  },
});
