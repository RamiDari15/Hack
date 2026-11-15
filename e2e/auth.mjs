// Shared sign-in for the browser tests: email and password through the real /sign-in page.
// Seeded @demo.test accounts use the local demo password; any other address is created on
// first use through "I'm new here" (local Supabase has email confirmation off).
export const DEMO_PASSWORD = 'vendora-demo';
export const TEST_PASSWORD = 'test-password-1234';

export async function signInWith(page, app, email, next = '/dashboard') {
  const password = email.endsWith('@demo.test') ? DEMO_PASSWORD : TEST_PASSWORD;
  await page.goto(`${app}/sign-in?next=${encodeURIComponent(next)}`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('main button[type=submit]');
  const landed = page.waitForURL((u) => u.pathname === next, { timeout: 20000 }).then(() => 'in');
  const wrong = page.getByText('Email or password is wrong.').waitFor({ timeout: 20000 }).then(() => 'new');
  if ((await Promise.race([landed, wrong])) === 'in') return 'signed-in';
  landed.catch(() => {});
  await page.getByRole('button', { name: 'I’m new here' }).click();
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('main button[type=submit]');
  await page.waitForURL((u) => u.pathname === next, { timeout: 20000 });
  return 'signed-up';
}
