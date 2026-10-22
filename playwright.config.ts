import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for the live site (or any deployment via BASE_URL). Read-only:
 * they never create accounts, pay, or save anything.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "https://meetwell.me",
    // Pages count as loaded once their content is in; images and video can follow.
    navigationTimeout: 20_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
