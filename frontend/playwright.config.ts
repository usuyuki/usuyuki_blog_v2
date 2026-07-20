import { defineConfig, devices } from "@playwright/test";

// E2Eテストの構成:
// 1. モックGhost APIサーバー(e2e/mock-ghost/server.mjs)を起動
// 2. ビルド済みのAstro SSRサーバー(dist/server/entry.mjs)をモックに向けて起動
// 3. chromium / firefox / webkit の3ブラウザで表示崩れを検査
// 事前に `pnpm build` で dist/ を生成しておくこと(CIではワークフローが実行する)。
const APP_PORT = Number(process.env.E2E_PORT ?? 4321);
const MOCK_GHOST_PORT = Number(process.env.MOCK_GHOST_PORT ?? 3999);
const baseURL = `http://127.0.0.1:${APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // モック相手の軽いスモークテストなのでCIでも並列数を上げて高速化する
  workers: process.env.CI ? "100%" : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "node e2e/mock-ghost/server.mjs",
      url: `http://127.0.0.1:${MOCK_GHOST_PORT}/health`,
      reuseExistingServer: true,
      env: {
        MOCK_GHOST_PORT: String(MOCK_GHOST_PORT),
      },
    },
    {
      command: "node dist/server/entry.mjs",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        HOST: "127.0.0.1",
        PORT: String(APP_PORT),
        GHOST_API_URL: `http://127.0.0.1:${MOCK_GHOST_PORT}`,
        // @tryghost/content-apiがキー形式(26桁hex)を検証するためダミーを渡す
        GHOST_CONTENT_KEY: "0123456789abcdef0123456789",
        GHOST_FRONT_URL: `http://127.0.0.1:${MOCK_GHOST_PORT}`,
        FRONTEND_URL: baseURL,
        // 外部ブログ(Qiita/Zenn)へのアクセスを無効化して決定的にする
        EXTERNAL_BLOGS: "[]",
      },
    },
  ],
});
