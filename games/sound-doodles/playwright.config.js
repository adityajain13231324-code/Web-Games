import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  use: {
    actionTimeout: 15000,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--no-proxy-server",
      ],
    },
    viewport: { width: 1280, height: 900 },
    permissions: ["microphone"],
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
