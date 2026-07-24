import { defineConfig, devices } from '@playwright/test';

/**
 * Testes E2E de UI (Playwright) contra o app real servido em backend/public/.
 * Precisam de um Postgres alcançável e do servidor Nest rodando (mesmas
 * exigências de `npm run test:e2e`, ver CLAUDE.md) — o globalSetup só
 * garante a conta super_admin de teste, não sobe o servidor nem o banco.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
