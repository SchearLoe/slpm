import { defineConfig } from '@playwright/test';

/**
 * SLPM E2E 冒烟测试配置。
 * 前置：后端 8080 + 前端 3000 已启动（npm run dev）。
 * 运行：npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
