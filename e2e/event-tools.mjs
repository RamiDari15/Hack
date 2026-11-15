// Event tools: guest list and RSVPs, registry, day-of timeline, quote comparison and email alerts.
// Reads the sample wedding, makes changes on one SQL-seeded test event (deleted at the end).
// Email alerts are checked in the local Mailpit inbox; nothing leaves the machine.
// Usage: APP_URL=http://localhost:3100 node e2e/event-tools.mjs
// Real: Supabase Auth (magic link via the local Mailpit inbox), Postgres, RLS, PostgREST.
// OpenAI is real only if the app was started with real keys and no *_BASE_URL overrides.
import { createRequire } from 'node:module';
// Playwright is not a project dependency; run with NODE_PATH pointing at a global install.
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';

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

async function latestLink(email, after) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    const msg = (list.messages || []).find((m) => new Date(m.Created).getTime() >= after);
    if (msg) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${msg.ID}`)).json();
      const m = (full.Text || full.HTML || '').match(/https?:\/\/[^\s"'<>)]+verify[^\s"'<>)]+/);
      if (m) return m[0].replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${email}`);
}

async function signIn(page, email, next = '/dashboard') {
  const t = Date.now() - 1000;
  await page.goto(`${APP}/sign-in?next=${encodeURIComponent(next)}`);
  await page.fill('#email', email);
  await page.click('main button[type=submit]');
  await page.getByText(`Check ${email}`).waitFor({ timeout: 15000 });
  const link = await latestLink(email, t);
  await page.goto(link);
  await page.waitForURL((u) => u.pathname === next, { timeout: 20000 });
}

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
const WEDDING = 'e0000000-0000-4000-8000-000000000001';
let eid = null;
const mails = async (to, subject) => {
  const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}" subject:"${subject}"`)}`)).json();
  return list.messages_count ?? (list.messages || []).length;
};
const waitMail = async (to, subject, before) => {
  for (let i = 0; i < 30; i++) { if ((await mails(to, subject)) > before) return true; await new Promise((r) => setTimeout(r, 500)); }
  return false;
};
try {
  [{ id: eid }] = await sql(`insert into public.events (owner_id, title, event_type, event_date, location, guest_count, budget_cents)
    values ('${MAYA}', 'Tools test ${stamp} (sample)', 'Birthday', '2027-08-01', 'Ann Arbor, MI', 100, 500000) returning id;`);
  const p = await page();
  await signIn(p, 'maya@demo.test', `/events/${WEDDING}/guests`);

  // Guest list on the sample wedding
  const stat = async (label) => (await p.locator('.stat-strip div', { hasText: label }).locator('dd').textContent()).trim();
  ok('wedding RSVP totals', (await stat('Coming')) === '3' && (await stat('Maybe')) === '3' && (await stat('No reply yet')) === '2' && (await stat('Expected')) === '8');
  ok('meal counts', await p.getByText('Salmon: 2').isVisible() && await p.getByText('Vegetarian: 1').isVisible());
  await shot(p, 'guests');

  // Guest list is off by default, then the organizer turns it on
  await p.goto(`${APP}/events/${eid}/guests`);
  ok('guest list is off by default', await p.getByRole('button', { name: 'Turn on guest list' }).isVisible());
  await p.getByRole('button', { name: 'Turn on guest list' }).click();
  await p.locator('#guests').waitFor({ timeout: 10000 });
  await p.fill('#meal_options', 'Pasta\nTacos');
  await p.getByRole('button', { name: 'Save meal options' }).click();
  await p.getByText('Guest list is on.').first().waitFor({ timeout: 10000 });
  await p.fill('#guests', `Zed Tester, zed-${stamp}@guests.test, 3\nYu Tester`);
  await p.getByRole('button', { name: 'Add to list' }).click();
  await p.getByText('Guests (2)').waitFor({ timeout: 10000 });
  ok('guests added from pasted lines', true);
  await p.fill('#guests', 'Bad Line, not-an-email');
  await p.getByRole('button', { name: 'Add to list' }).click();
  ok('bad email is rejected', await p.getByText('does not look like an email').isVisible({ timeout: 5000 }).catch(() => false) || await p.getByText('does not look like an email').waitFor({ timeout: 5000 }).then(() => true));
  const zedLink = await p.locator('li', { hasText: 'Zed Tester' }).locator('[data-copy]').getAttribute('data-copy');
  const yuLink = await p.locator('li', { hasText: 'Yu Tester' }).locator('[data-copy]').getAttribute('data-copy');
  ok('each guest has an RSVP link', /\/rsvp\/[0-9a-f-]{36}$/.test(zedLink) && zedLink !== yuLink);
  ok('email invite opens the organizer’s mail app', (await p.locator('li', { hasText: 'Zed Tester' }).getByRole('link', { name: 'Email invite' }).getAttribute('href')).startsWith('mailto:zed-'));

  // Registry
  await p.goto(`${APP}/events/${eid}/registry`);
  await p.getByRole('button', { name: 'Turn on registry' }).click();
  await p.locator('#r-title').waitFor({ timeout: 10000 });
  await p.fill('#r-title', 'Sample gift: board game');
  await p.fill('#r-price', 'About $30');
  await p.getByRole('button', { name: 'Add gift' }).click();
  await p.getByText('Gifts (1)').waitFor({ timeout: 10000 });
  ok('registry item added', true);

  // Guests reply without an account
  const g = await page();
  await g.goto(zedLink.replace(/^https?:\/\/[^/]+/, APP));
  ok('RSVP page greets the guest', await g.getByText('Hi Zed Tester, can you come?').isVisible());
  await g.check('input[name=status][value=yes]');
  await g.selectOption('#attending', '2');
  await g.selectOption('#meal', 'Tacos');
  await g.fill('#dietary', 'Gluten free');
  await g.getByRole('button', { name: 'Send reply' }).click();
  await g.getByText('Your reply is saved').waitFor({ timeout: 10000 });
  ok('guest RSVP saved', true);
  await g.getByRole('button', { name: 'I’ll get this' }).click();
  await g.locator('.badge', { hasText: 'Yours' }).waitFor({ timeout: 10000 });
  ok('guest claims a gift', true);
  await shot(g, 'rsvp', true);
  const g2 = await page();
  await g2.goto(yuLink.replace(/^https?:\/\/[^/]+/, APP));
  ok('another guest sees the gift as claimed', await g2.locator('.badge', { hasText: 'Claimed' }).isVisible());
  ok('guests cannot see who claimed', !(await g2.getByText('Zed Tester').count()));
  await g2.goto(`${APP}/rsvp/00000000-0000-4000-8000-000000000000`);
  ok('unknown RSVP link is not active', await g2.getByText('This RSVP link is not active').isVisible());

  await p.goto(`${APP}/events/${eid}/guests`);
  ok('organizer sees the reply', (await stat('Coming')) === '2' && await p.getByText('Tacos: 2').isVisible());
  await p.getByRole('button', { name: 'Use 3 as the guest count' }).click();
  await p.getByRole('button', { name: /as the guest count/ }).waitFor({ state: 'detached', timeout: 10000 });
  ok('RSVP headcount updates the event guest count', (await sql(`select guest_count from public.events where id = '${eid}';`))[0].id === '3');
  await p.goto(`${APP}/events/${eid}/registry`);
  ok('organizer sees who claimed', await p.getByText('Claimed by Zed Tester').isVisible());

  // Turning the guest list off closes the links
  await p.goto(`${APP}/events/${eid}/guests`);
  await p.getByRole('button', { name: 'Turn off guest list' }).click();
  await p.getByRole('button', { name: 'Turn on guest list' }).waitFor({ timeout: 10000 });
  await g.reload();
  ok('RSVP link stops working when the list is off', await g.getByText('This RSVP link is not active').isVisible());

  // Day-of timeline
  await p.goto(`${APP}/events/${WEDDING}/timeline`);
  ok('wedding timeline lists seeded items in order', (await p.locator('.timeline li .title').first().textContent()).includes('opens for setup'));
  await p.goto(`${APP}/events/${eid}/timeline`);
  await p.getByRole('button', { name: 'Draft with AI' }).click();
  await p.getByText(/Drafted \d+ items/).waitFor({ timeout: 20000 });
  await p.locator('.timeline li').first().waitFor({ timeout: 10000 });
  ok('AI draft saves valid items only', (await p.locator('.timeline li').count()) === 2, await p.locator('.timeline li').count());
  ok('AI items are labeled', (await p.locator('.timeline .badge', { hasText: 'AI draft' }).count()) === 2);
  await p.fill('#t-start', '10:30');
  await p.fill('#t-title', 'Pick up the cake');
  await p.getByRole('button', { name: 'Add to timeline' }).click();
  await p.locator('.timeline li', { hasText: 'Pick up the cake' }).waitFor({ timeout: 10000 });
  ok('organizer adds a timeline item, sorted first', (await p.locator('.timeline li .title').first().textContent()) === 'Pick up the cake');
  await p.getByRole('button', { name: 'Remove all AI draft items' }).click();
  await p.waitForFunction(() => document.querySelectorAll('.timeline li').length === 1, null, { timeout: 10000 });
  ok('AI items can be cleared, organizer items stay', true);
  await shot(p, 'timeline');

  // Compare quotes
  await p.goto(`${APP}/events/${WEDDING}/quotes`);
  ok('quote comparison lists vendors by category', await p.locator('.compare-table').first().isVisible() && await p.getByRole('link', { name: 'Sample Table Kitchen' }).isVisible());
  ok('comparison shows the estimate', await p.getByText('AI estimate').first().isVisible());
  await shot(p, 'compare-quotes');

  // Email alerts: vendor messages the organizer
  const v = await page();
  await signIn(v, 'kitchen@demo.test', '/bookings/b0000000-0000-4000-8000-000000000002');
  ok('vendor sees the timeline section only when linked', (await v.getByRole('heading', { name: 'On the day' }).count()) === 0);
  let before = await mails('maya@demo.test', 'Message from Sample Table Kitchen');
  await v.fill('#msg-body', `Alert test ${stamp}`);
  await v.click('button:has-text("Send message")');
  await v.locator('.bubble-mine', { hasText: `Alert test ${stamp}` }).waitFor({ timeout: 10000 });
  ok('organizer gets an email alert for a new message', await waitMail('maya@demo.test', 'Message from Sample Table Kitchen', before));
  await p.goto(`${APP}/account`);
  await p.uncheck('input[name=email_alerts]');
  await p.getByRole('button', { name: 'Save' }).click();
  await p.getByText('Saved.').waitFor({ timeout: 10000 });
  before = await mails('maya@demo.test', 'Message from Sample Table Kitchen');
  await v.fill('#msg-body', `Quiet test ${stamp}`);
  await v.click('button:has-text("Send message")');
  await v.locator('.bubble-mine', { hasText: `Quiet test ${stamp}` }).waitFor({ timeout: 10000 });
  await new Promise((r) => setTimeout(r, 4000));
  ok('no email when alerts are off', (await mails('maya@demo.test', 'Message from Sample Table Kitchen')) === before);
  await p.reload();
  await p.check('input[name=email_alerts]');
  await p.getByRole('button', { name: 'Save' }).click();
  await p.getByText('Saved.').waitFor({ timeout: 10000 });

  const lv = await page();
  await signIn(lv, 'lanterns@demo.test', '/bookings/b0000000-0000-4000-8000-000000000001');
  ok('linked vendor sees its times on the booking', await lv.getByRole('heading', { name: 'On the day' }).isVisible());
  const anon = await page();
  const r = await anon.goto(`${APP}/events/${eid}/timeline`);
  ok('timeline requires sign-in', /sign-in/.test(anon.url()), r?.status());
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  if (eid) await sql(`delete from public.events where id = '${eid}';`).catch(() => {});
  await sql(`delete from public.messages where body like 'Alert test %' or body like 'Quiet test %';`).catch(() => {});
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
