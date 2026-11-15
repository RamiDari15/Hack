// Planning walkthrough: the step guide on the event page, the vendor walkthrough (ranking, AI help,
// quote request) and the sponsor contact page. Seeds one test event for the sample organizer by SQL
// and deletes it at the end, so the sample wedding stays as it was.
// Usage: APP_URL=http://localhost:3100 node e2e/walkthrough.mjs
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
const MAYA = 'd0000000-0000-4000-8000-000000000001';
let eid = null;
try {
  [{ id: eid }] = await sql(`insert into public.events (owner_id, title, event_type, event_date, location, guest_count, budget_cents, style)
    values ('${MAYA}', 'Walkthrough test ${stamp} (sample)', 'Wedding', '2027-06-12', 'Ann Arbor, MI', 150, 3000000, 'Garden') returning id;`);
  await sql(`insert into public.ai_requests (user_id, kind, event_id, input, output)
    select user_id, 'plan', '${eid}', input, output from public.ai_requests where event_id = 'e0000000-0000-4000-8000-000000000001' and kind = 'plan' limit 1 returning id;`);

  const p = await page();
  await signIn(p, 'maya@demo.test', `/events/${eid}`);
  const guide = p.locator('.plan-guide');
  ok('event page shows the step-by-step guide', await guide.isVisible());
  ok('details and estimate steps are done', (await guide.locator('li.is-done').count()) === 2, await guide.locator('li.is-done').count());
  ok('choose vendors is the next step', (await guide.locator('li[aria-current=step] .title').textContent()).includes('Choose vendors'));
  ok('guide lists AI-generated tasks', await guide.getByText('Tasks the planner generated for this event').isVisible());
  ok('event page has a Contact sponsors CTA', await p.locator('.page-actions').getByRole('link', { name: 'Contact sponsors' }).isVisible());
  await shot(p, 'event-guide');

  await guide.getByRole('link', { name: 'Choose vendors' }).click();
  await p.waitForURL(/\/choose\?step=/);
  ok('walkthrough starts at Venues', (await p.locator('#step-h').textContent()) === 'Venues');
  ok('walkthrough shows the category estimate', await p.getByText(/Your AI estimate for venues is/).isVisible());
  const best = p.locator('.match-card.is-best');
  ok('a best fit is highlighted', await best.isVisible());
  ok('best fit is a verified vendor', await best.locator('.badge', { hasText: 'Verified' }).count() > 0);
  ok('reasons come from data', (await best.locator('.reasons li').count()) >= 3);
  const lantern = p.locator('.match-card', { hasText: 'Sample Lantern Hall' });
  ok('calendar conflict is shown for a booked date', await lantern.getByText(/Has a tentative hold on your date|Busy on your date/).count() > 0 || await lantern.count() === 0);
  await shot(p, 'choose-venues');

  await p.getByRole('button', { name: /Compare venues with AI/ }).click();
  await p.locator('.advice').getByText('AI suggestion').waitFor({ timeout: 20000 });
  ok('AI help shows a suggested vendor', await p.locator('.advice .badge', { hasText: 'Suggested:' }).isVisible());
  ok('AI help drops invented vendors', (await p.locator('.advice li b').count()) === 1, await p.locator('.advice li b').count());
  ok('AI help lists questions to ask', await p.getByText('Is our date open?').isVisible());

  const firstVerified = p.locator('.match-grid').first().locator('.match-card:has(form)').first();
  const vname = await firstVerified.locator('h3').textContent();
  await firstVerified.locator('input[name=confirm]').check();
  await firstVerified.getByRole('button', { name: 'Request a quote' }).click();
  await p.locator('.match-card', { hasText: vname }).getByRole('link', { name: 'Open conversation' }).waitFor({ timeout: 10000 });
  ok('quote request from the walkthrough creates an inquiry', true);
  ok('Venues step shows as contacted', await p.locator('.choose-steps a.is-done', { hasText: 'Venues' }).isVisible());

  await p.getByRole('link', { name: /^Next: / }).click();
  await p.waitForURL((u) => !u.search.includes('Venues'));
  ok('next goes to the second category', (await p.locator('#step-h').textContent()) !== 'Venues');
  await shot(p, 'choose-next', true);

  await p.goto(`${APP}/events/${eid}/sponsors`);
  ok('sponsors page says Vendora never sends', await p.getByText('Vendora never contacts sponsors for you').isVisible());
  await p.fill('#sp-name', `Sample Test Bakery ${stamp}`);
  await p.fill('#sp-contact_email', 'hello@sample-bakery.test');
  await p.fill('#sp-reason', 'it makes wedding favors');
  await p.getByRole('button', { name: 'Add to list' }).click();
  const lead = p.locator('article', { hasText: `Sample Test Bakery ${stamp}` });
  await lead.waitFor({ timeout: 10000 });
  const draft = await lead.locator('textarea').inputValue();
  ok('proposal is drafted from event details', draft.includes('150 guests') && draft.includes('Ann Arbor') && draft.includes('wedding favors'), draft.slice(0, 200));
  const mail = await lead.getByRole('link', { name: /^Email / }).getAttribute('href');
  ok('email link opens the user’s own mail app', mail.startsWith('mailto:hello@sample-bakery.test?subject='));
  await lead.getByRole('button', { name: 'Mark as contacted' }).click();
  await lead.locator('.badge', { hasText: 'Contacted' }).waitFor({ timeout: 10000 });
  ok('lead can be marked contacted', true);
  await shot(p, 'sponsors');

  await p.goto(`${APP}/events/${eid}`);
  ok('sponsor step is done on the guide', await p.locator('.plan-guide li.is-done', { hasText: 'Contact sponsors' }).isVisible());
  ok('guide shows progress out of 7 steps', /of 7 done/.test(await p.locator('.plan-guide .badge').first().textContent()));

  const ps = await page();
  await ps.goto(`${APP}/events/${eid}/choose`);
  await ps.waitForURL(/sign-in/);
  ok('walkthrough requires sign-in', true);
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  if (eid) await sql(`delete from public.event_vendors where event_id = '${eid}'; delete from public.events where id = '${eid}';`).catch(() => {});
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
