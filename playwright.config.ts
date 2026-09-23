import { defineConfig, devices } from '@playwright/test'

const PREVIEW_PORT = 4173

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  // 性能基准与其他测试并行会互相干扰, 用 `pnpm test:perf` 单独串行运行
  testIgnore: process.env['PERF'] ? [] : ['**/perf/**'],
  fullyParallel: true,
  reporter: 'list',
  snapshotPathTemplate: 'tests/visual/__screenshots__/{projectName}/{arg}{ext}',
  use: { baseURL: `http://localhost:${PREVIEW_PORT}`, trace: 'on-first-retry' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    port: PREVIEW_PORT,
    reuseExistingServer: true,
  },
  projects: [
    // channel: 'chromium' 使用完整版 Chromium 的新 headless 模式, 行为与真实浏览器一致
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chromium' } },
  ],
})
