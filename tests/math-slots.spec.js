import { test, expect } from "@playwright/test";

async function insertFraction(page) {
  await page.goto("/");
  await page.locator("#math-latex-output").fill("\\frac{□}{□}");
  await page.locator("#insert-formula").click();
  await expect(page.locator(".math-slot")).toHaveCount(2);
}

async function placeCaret(page, slotIndex, offset) {
  await page.locator(".math-slot").nth(slotIndex).evaluate((slot, caretOffset) => {
    const textNode = slot.firstChild || slot.appendChild(document.createTextNode(""));
    const range = document.createRange();
    range.setStart(textNode, caretOffset);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    slot.focus();
  }, offset);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await insertFraction(page);
});

test("several consecutive Backspaces keep the slot DOM and caret stable", async ({ page }) => {
  const numerator = page.locator(".math-slot").first();
  await numerator.fill("abcd");
  await numerator.evaluate((slot) => { window.originalMathSlot = slot; });

  await numerator.press("Backspace");
  await numerator.press("Backspace");

  await expect(numerator).toHaveText("ab");
  await expect(numerator.evaluate((slot) => slot === window.originalMathSlot)).resolves.toBe(true);
});

test("Delete removes the character after a caret in the middle", async ({ page }) => {
  const numerator = page.locator(".math-slot").first();
  await numerator.fill("abcd");
  await placeCaret(page, 0, 2);
  await numerator.press("Delete");
  await expect(numerator).toHaveText("abd");
});

test("a whole slot can be selected and emptied", async ({ page }) => {
  const numerator = page.locator(".math-slot").first();
  await numerator.fill("whole value");
  await numerator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await numerator.press("Backspace");
  await expect(numerator).toBeEmpty();
});

test("Backspace in an empty denominator moves to the numerator", async ({ page }) => {
  const numerator = page.locator(".math-slot").first();
  const denominator = page.locator(".math-slot").nth(1);
  await numerator.fill("123");
  await denominator.focus();
  await denominator.press("Backspace");
  await expect(numerator).toBeFocused();

  const caretOffset = await page.evaluate(() => window.getSelection()?.anchorOffset);
  expect(caretOffset).toBe(3);
});

test("the edited fraction is serialized with current slot values", async ({ page }) => {
  await page.locator(".math-slot").first().fill("x+1");
  await page.locator(".math-slot").nth(1).fill("y-2");

  const chatRequest = page.waitForRequest((request) => request.url().endsWith("/api/chat"));
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ reply: "ok" })
  }));
  await page.route("**/api/state-summary", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ updatedSummary: "" })
  }));
  await page.locator("#send").click();

  const payload = (await chatRequest).postDataJSON();
  expect(payload.messages.at(-1).content).toBe("$\\frac{x+1}{y-2}$");
});
