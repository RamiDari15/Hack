// Marketplace flow, all through the UI: vendor applies, admin verifies, organizer sends an inquiry,
// vendor quotes and messages, organizer accepts and confirms. The only SQL is granting the admin role.
// Usage: APP_URL=http://localhost:3100 node e2e/marketplace.mjs
// Real: Supabase Auth (email and password), Postgres, RLS, PostgREST.
// OpenAI is real only if the app was started with real keys and no *_BASE_URL overrides.
import { createRequire } from 'node:module';
// Playwright is not a project dependency; run with NODE_PATH pointing at a global install.
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { signInWith } from './auth.mjs';

const APP = process.env.APP_URL || 'http://localhost:3100';
const MAIL = process.env.MAILPIT_URL || 'http://127.0.0.1:55324';
const SEED = process.env.E2E_SEED !== 'off';
const stamp = Date.now();
const V = `vendor-${stamp}@example.test`;
const ADM = `admin-${stamp}@example.test`;
const O = `organizer-${stamp}@example.test`;
const X = `stranger-${stamp}@example.test`;
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : info); };

const signIn = (page, email, next = '/dashboard') => signInWith(page, APP, email, next);

// Test-only seeding through psql in the local database container (never against a hosted project).
const DB_CONTAINER = process.env.DB_CONTAINER || 'supabase_db_vendora';
const sql = async (query) => {
  const out = execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map((id) => ({ id }));
};


const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = async () => (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
// Optional screenshots: SHOTS=/some/dir node e2e/marketplace.mjs
const SHOTS = process.env.SHOTS;
const shot = async (p, name, phone) => {
  if (!SHOTS) return;
  if (phone) await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  if (phone) await p.setViewportSize({ width: 1440, height: 900 });
};
try {
  // 1. Vendor applies
  const pv = await page();
  await signIn(pv, V, '/vendor');
  ok('new user sees the apply prompt', await pv.getByRole('link', { name: 'Apply as a vendor' }).isVisible());
  await pv.goto(`${APP}/vendor/apply`);
  await pv.click('main button[type=submit]');
  await pv.locator('.error').first().waitFor({ timeout: 10000 });
  ok('empty application shows field errors', (await pv.locator('.error').count()) >= 3);
  await pv.fill('#name', `E2E Lantern Hall ${stamp}`);
  await pv.selectOption('#category', 'Venues');
  await pv.fill('#city', 'Ann Arbor');
  await pv.fill('#service_radius_mi', '30');
  await pv.fill('#description', 'Test venue created by the end-to-end test.');
  await pv.fill('#legal_name', `E2E Lantern Hall ${stamp} LLC`);
  await pv.fill('#website', 'https://example.com');
  await pv.check('input[name=confirm]');
  await pv.click('main button[type=submit]');
  await pv.waitForURL(/\/vendor\/profile\/[0-9a-f-]{36}\?submitted=1/, { timeout: 15000 });
  const vid = pv.url().split('/').pop().split('?')[0];
  ok('application lands on the profile, in review', await pv.locator('.badge', { hasText: 'In review' }).first().isVisible());
  await pv.fill('#pkg-title', 'Evening hall hire');
  await pv.fill('#pkg-price', '3200');
  await pv.click('button:has-text("Add package")');
  await pv.getByText('Added Evening hall hire.').waitFor({ timeout: 10000 });
  ok('vendor adds a package', true);
  await shot(pv, 'vendor-profile');
  const before = await fetch(`${APP}/vendors/${vid}`);
  ok('pending vendor is not public', before.status === 404, `status ${before.status}`);

  // 2. Admin verifies (the admin role can only be granted in the database)
  const pa = await page();
  await signIn(pa, ADM, '/dashboard');
  const r404 = await pa.goto(`${APP}/admin`);
  ok('non-admin gets 404 on /admin', r404.status() === 404, `status ${r404.status()}`);
  await sql(`update public.profiles set roles = '{customer,admin}' where id = (select id from auth.users where email = '${ADM}');`);
  await pa.goto(`${APP}/admin`);
  const card = pa.locator('li.panel', { hasText: `E2E Lantern Hall ${stamp}` });
  ok('admin sees the pending application with review details', await card.getByText(`E2E Lantern Hall ${stamp} LLC`).isVisible());
  await shot(pa, 'admin-review');
  await card.locator('button:has-text("Ask for changes")').click();
  await card.getByText('Tell the vendor what to fix.').waitFor({ timeout: 10000 });
  ok('asking for changes requires a note', true);
  await card.locator('button:has-text("Verify")').click();
  await card.waitFor({ state: 'detached', timeout: 10000 });
  await pa.goto(`${APP}/admin?show=verified`);
  ok('admin verifies the vendor', await pa.locator('li.panel', { hasText: `E2E Lantern Hall ${stamp}` }).isVisible());
  await pv.reload();
  ok('vendor sees Verified', await pv.locator('.badge', { hasText: 'Verified' }).first().isVisible());

  // 3. Organizer creates an event and sends an inquiry
  const po = await page();
  await signIn(po, O);
  await po.goto(`${APP}/events/new`);
  await po.fill('#title', 'E2E Lantern Birthday');
  await po.selectOption('#event_type', 'Birthday');
  await po.fill('#event_date', '2027-08-20');
  await po.fill('#location', 'Ann Arbor, MI');
  await po.fill('#guest_count', '60');
  await po.click('main button[type=submit]');
  await po.waitForURL(/\/events\/[0-9a-f-]{36}/);
  const eventId = po.url().split('?')[0].split('/').pop();
  await po.goto(`${APP}/vendors/${vid}`);
  ok('verified vendor profile is public, with its package', await po.getByText('Evening hall hire').first().isVisible());
  await po.selectOption('#rq-event', eventId);
  await po.check('input[name=confirm]');
  await po.click('button:has-text("Send inquiry")');
  await po.getByText('Your conversation is ready.').waitFor({ timeout: 15000 });
  ok('organizer sends an inquiry', true);

  // 4. Vendor answers: message and quote
  await pv.goto(`${APP}/vendor`);
  const req = pv.locator('a.event-row', { hasText: 'Birthday' });
  ok('request appears in the vendor inbox with event details', await req.getByText('Ann Arbor, MI').first().isVisible());
  await shot(pv, 'vendor-inbox');
  await req.first().click();
  await pv.waitForURL(/\/bookings\/[0-9a-f-]{36}/);
  const bookingUrl = pv.url();
  await pv.fill('#msg-body', 'Thanks! The hall is free that evening.');
  await pv.click('button:has-text("Send message")');
  await pv.locator('.bubble-mine', { hasText: 'The hall is free' }).waitFor({ timeout: 10000 });
  ok('vendor sends a message', true);
  await pv.fill('#q-amount', '2950');
  await pv.fill('#q-desc', 'Hall hire, 6pm to midnight');
  await pv.click('button:has-text("Send quote")');
  ok('quote is blocked until the confirm box is ticked', (await pv.locator('form:has(#q-amount) input[name=confirm]:invalid').count()) === 1 && (await pv.getByText('Quote sent.').count()) === 0);
  await pv.check('form:has(#q-amount) input[name=confirm]');
  await pv.click('button:has-text("Send quote")');
  await pv.getByText('Quote sent.').waitFor({ timeout: 10000 });
  ok('vendor sends a quote', await pv.locator('.badge', { hasText: 'Quote received' }).first().isVisible());

  // 5. A stranger cannot open the booking
  const px = await page();
  await signIn(px, X);
  const rx = await px.goto(bookingUrl);
  ok('stranger gets 404 on the booking', rx.status() === 404, `status ${rx.status()}`);

  // 6. Organizer reads, accepts and confirms
  await po.goto(`${APP}/events/${eventId}`);
  await po.locator('.booking-list a', { hasText: 'Open' }).first().click();
  await po.waitForURL(/\/bookings\//);
  ok('organizer sees the vendor message', await po.locator('.bubble', { hasText: 'The hall is free' }).isVisible());
  ok('organizer sees the quote labeled Vendor quote', await po.locator('.source, .badge', { hasText: 'Vendor quote' }).first().isVisible() && await po.getByText('$2,950').first().isVisible());
  await shot(po, 'booking-organizer'); await shot(po, 'booking-organizer-phone', true);
  ok('confirm is not offered before accepting', (await po.locator('button:has-text("Confirm booking")').count()) === 0);
  await po.click('button:has-text("Accept quote")');
  await po.locator('.badge', { hasText: 'Accepted' }).waitFor({ timeout: 10000 });
  ok('accepting shows the quote as Accepted', true);
  await po.check('form:has(button:has-text("Confirm booking")) input[name=confirm]');
  await po.click('button:has-text("Confirm booking")');
  await po.getByText('Booking confirmed at $2,950').waitFor({ timeout: 10000 });
  ok('booking is confirmed', await po.locator('.badge', { hasText: 'Confirmed' }).first().isVisible());
  await pv.reload();
  await shot(pv, 'booking-vendor-confirmed');
  ok('vendor sees the confirmation', await pv.locator('.badge', { hasText: 'Confirmed' }).first().isVisible());
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
