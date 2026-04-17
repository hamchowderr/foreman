import { test, expect } from "@playwright/test";

test("homepage loads and shows Foreman", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Foreman");
});

test("sign-in page renders form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("h1")).toContainText("Sign In");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});
