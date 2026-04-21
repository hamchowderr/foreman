import { test, expect } from "@playwright/test";

test("homepage redirects unauthenticated users to sign-up", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/sign-up", { timeout: 10000 });
  await expect(page.locator("h1")).toContainText("Sign Up");
});

test("sign-in page renders form", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("h1")).toContainText("Sign In");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test.describe("authenticated chat flow", () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  test.beforeEach(async ({ page }) => {
    // Sign up a fresh user
    await page.goto("/sign-up");
    await page.locator("#name").fill("Test User");
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // Wait for sign-up to complete (session cookie set)
    await page.waitForResponse(
      (res) => res.url().includes("/api/auth") && res.status() === 200
    );

    // Navigate to home
    await page.goto("/");
    await expect(page.getByTestId("new-chat-button")).toBeVisible();
  });

  test("can create a new conversation", async ({ page }) => {
    await page.getByTestId("new-chat-button").click();

    // Should show the chat input
    await expect(
      page.locator('textarea[placeholder="Message Foreman..."]')
    ).toBeVisible();
  });

  test("can send a message and see mock LLM response", async ({ page }) => {
    await page.getByTestId("new-chat-button").click();

    const input = page.locator('textarea[placeholder="Message Foreman..."]');
    await expect(input).toBeVisible();

    // Send "hello" — should match the greeting fixture
    await input.fill("hello");
    await page.locator("button", { hasText: "Send" }).click();

    // User message should appear
    await expect(page.locator(".justify-end .rounded-xl").first()).toContainText(
      "hello"
    );

    // Agent response should stream in (from LLMock greeting fixture)
    await expect(
      page.locator(".justify-start .rounded-xl").first()
    ).toContainText("Foreman", { timeout: 10000 });
  });
});
