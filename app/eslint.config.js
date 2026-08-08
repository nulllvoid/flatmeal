// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // e2e/ is Playwright test/fixture code, not React — the
    // react-hooks/rules-of-hooks rule misfires on fixture helper functions
    // that happen to call Playwright's own `use()` (test.extend callbacks),
    // mistaking them for React components/hooks by naming convention alone.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);
