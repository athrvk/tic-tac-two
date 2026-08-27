// Playwright config for tic-tac-two end-to-end tests.
// The app (backend serving the production frontend build) must be running;
// see .github/workflows/e2e.yml or README for how to start it.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  // Tests share one backend and its matchmaking state — run serially
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    // Allows pointing at a pre-installed Chromium (e.g. containers with
    // PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium) instead of downloading
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
});
