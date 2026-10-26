import { expect, test } from "@playwright/test";

// A published card to check. Set SMOKE_CARD to use a different one.
const CARD = process.env.SMOKE_CARD ?? "abdur-rasheed-idris";

test("home page loads and the demo video opens", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet someone");
  await page.getByRole("button", { name: "See how it works" }).click();
  await expect(page.getByRole("dialog", { name: "Meetwell demo video" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a public card shows Save contact and serves its contact file", async ({ page, request }) => {
  await page.goto(`/p/${CARD}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Save contact/ })).toBeVisible();
  const vcard = await request.get(`/p/${CARD}/vcard`);
  expect(vcard.status()).toBe(200);
  expect(vcard.headers()["content-type"]).toContain("text/vcard");
  expect(await vcard.text()).toContain("BEGIN:VCARD");
});

test("sign-up needs the 18+ tick", async ({ page }) => {
  await page.goto(`/join?via=${CARD}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("By ticking this box, you confirm you are at least 18 years old.")).toBeVisible();
  await page.getByRole("button", { name: "Create my free card" }).click();
  await expect(page.getByText("You need to be 18 or older to use Meetwell.")).toBeVisible();
});

test("log-in says when an email has no account", async ({ page }) => {
  await page.goto("/sign-in?method=email", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("no-such-member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: /Log in/ }).click();
  await expect(page.getByText("We couldn't find an account with that email.", { exact: false })).toBeVisible();
});

for (const path of ["/about", "/support", "/changelog", "/terms", "/privacy", "/community-rules", "/features/mentoring"]) {
  test(`${path} loads`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("the admin area asks for the admin log-in", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test("dark mode follows the device", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(250, 250, 248)"); // the light background
  await context.close();
});
