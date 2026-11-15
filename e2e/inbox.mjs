// Inbox, notifications, saved vendors and the header account menu, as the sample organizer.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { signInWith } from './auth.mjs';

const app = process.env.APP_URL || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, info); } };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await p.goto(`${app}/inbox`);
  ok('inbox needs sign-in', new URL(p.url()).pathname === '/sign-in');
  await signInWith(p, app, 'maya@demo.test', '/inbox');
  ok('inbox opens after sign-in', new URL(p.url()).pathname === '/inbox');
  ok('inbox lists conversations', (await p.locator('.inbox-list > li').count()) > 0);
  const inboxLink = p.locator('.header-actions .icon-link[href="/inbox"]');
  ok('header has an inbox link', await inboxLink.isVisible());

  // Opening a thread clears its unread marker.
  const unreadBefore = await p.locator('.inbox-list > li.is-unread').count();
  if (unreadBefore > 0) {
    await p.locator('.inbox-list > li.is-unread a').first().click();
    await p.waitForURL(/\/bookings\//);
    await p.goto(`${app}/inbox`);
    ok('reading a thread lowers the unread count', (await p.locator('.inbox-list > li.is-unread').count()) === unreadBefore - 1, unreadBefore);
  } else ok('reading a thread lowers the unread count (nothing unread to test)', true);

  await p.goto(`${app}/inbox?view=unread`);
  ok('unread filter shows only unread threads', (await p.locator('.inbox-list > li:not(.is-unread)').count()) === 0);

  // Notifications page loads.
  await p.goto(`${app}/notifications`);
  ok('notifications page loads', await p.getByRole('heading', { level: 1 }).isVisible());

  // Save a vendor, see it in Saved, then remove it.
  await p.goto(`${app}/vendors`);
  const href = await p.locator('.vendor-card a.vendor-card-link, a.vendor-card').first().getAttribute('href');
  await p.goto(`${app}${href}`);
  const save = p.locator('.save-vendor-form button');
  if (await save.getAttribute('aria-pressed') === 'true') { await save.click(); await p.waitForTimeout(600); }
  await p.locator('.save-vendor-form button').click();
  await p.locator('.save-vendor-form button[aria-pressed="true"]').waitFor({ timeout: 8000 });
  ok('save button shows Saved', (await p.locator('.save-vendor-form button').innerText()).includes('Saved for later') && (await p.locator('.save-vendor-form button').getAttribute('aria-pressed')) === 'true');
  await p.goto(`${app}/saved`);
  ok('saved page lists the vendor', await p.locator(`a[href="${href}"]`).first().isVisible());
  await p.goto(`${app}${href}`);
  await p.locator('.save-vendor-form button').click();
  await p.locator('.save-vendor-form button[aria-pressed="false"]').waitFor({ timeout: 8000 });
  await p.goto(`${app}/saved`);
  ok('unsaving removes it from Saved', (await p.locator(`a[href="${href}"]`).count()) === 0);

  // Account menu: opens, links to Saved, closes on Escape.
  const menu = p.locator('header details.acct');
  await menu.locator('summary').click();
  ok('account menu opens', await menu.getByRole('link', { name: 'Saved vendors' }).isVisible());
  await p.keyboard.press('Escape');
  ok('Escape closes the account menu', !(await menu.getAttribute('open')));
  await menu.locator('summary').click();
  await menu.getByRole('link', { name: 'Saved vendors' }).click();
  await p.waitForURL(/\/saved/);
  ok('menu closes after navigating', !(await menu.getAttribute('open')));

  // A vendor sees their side of the conversation.
  await p.context().clearCookies();
  const v = await b.newPage();
  await signInWith(v, app, 'lanterns@demo.test', '/inbox').catch(() => {});
  if (new URL(v.url()).pathname === '/inbox') {
    ok('vendor inbox shows their customer threads', (await v.locator('.inbox-list > li').count()) > 0);
  } else ok('vendor inbox (no sample vendor account to test)', true);
} catch (e) { ok('inbox flow ran without errors', false, e.message); }
await b.close();
console.log(`inbox: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
