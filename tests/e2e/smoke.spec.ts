import { test, expect } from "@playwright/test";

test("home page renders call-to-action buttons", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gift Circle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join room" })).toBeVisible();
});
