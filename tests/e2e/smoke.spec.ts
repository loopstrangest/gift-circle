import { test, expect } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
];

for (const viewport of viewports) {
  test.describe(`${viewport.name} viewport`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("home page renders call-to-action buttons", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "Gift Circle", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Host a room" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Join a room" })).toBeVisible();
    });
  });
}
