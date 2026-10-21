import { defineConfig } from "@playwright/test";
import checks from "./playwright.config.ts";

export default defineConfig({
  ...checks,
  use: { ...checks.use, baseURL: "http://127.0.0.1:4173/careflow-dashboard/" },
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4173/careflow-dashboard/",
    reuseExistingServer: false,
  },
});
