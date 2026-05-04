import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for DezTehYug CRM E2E tests.
 *
 * Тесты запускают свой dev-сервер (если ещё не запущен на 3000) и гоняют
 * happy-path Регины: лид → клиент → сделка → прайс → документ → акт.
 *
 * Запуск: npm run test:e2e
 * Дев-сервер должен быть на чистой БД (или допускать дополнительные записи).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // тесты модифицируют общую БД — не параллелим
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
