// Planning tools: vendor filters, shortlist and compare, package and budget trade-offs, shared planning
// (invite, votes, comments, tasks), style board, event website, weather risk (NASA POWER) and seating.
// Uses one SQL-seeded test event (deleted at the end). NASA POWER is the local stand-in when NASA_POWER_BASE_URL points at it.
// Usage: APP_URL=http://localhost:3100 node e2e/planning-tools.mjs
// OpenAI is real only if the app was started with real keys and no *_BASE_URL overrides.
import { createRequire } from 'node:module';
// Playwright is not a project dependency; run with NODE_PATH pointing at a global install.
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { signInWith } from './auth.mjs';

const APP = process.env.APP_URL || 'http://localhost:3100';
const MAIL = process.env.MAILPIT_URL || 'http://127.0.0.1:55324';
const stamp = Date.now();
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
// Optional screenshots: SHOTS=/some/dir node e2e/planning-tools.mjs
const SHOTS = process.env.SHOTS;
const shot = async (p, name, phone) => {
  if (!SHOTS) return;
  if (phone) await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  if (phone) await p.setViewportSize({ width: 1440, height: 900 });
};
// Optional screenshots: SHOTS=/some/dir node e2e/marketplace.mjs
const MAYA = 'd0000000-0000-4000-8000-000000000001';
const H = 'a0000000-0000-4000-8000-000000000001', BARN = 'a0000000-0000-4000-8000-000000000002', KITCHEN = 'a0000000-0000-4000-8000-000000000003';
const HELPER = `helper-${stamp}@example.test`;
let eid = null;
const rel = (u) => u.replace(/^https?:\/\/[^/]+/, APP);
const text = async (p) => (await p.locator('main').innerText()).replace(/\s+/g, ' ');
const money = (s) => Number(String(s).replace(/[^0-9]/g, ''));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4EVBBEmIY1TCqYfhqAAD27JAQi4MRsgAAAABJRU5ErkJggg==', 'base64');

try {
  [{ id: eid }] = await sql(`insert into public.events (owner_id, title, event_type, event_date, location, guest_count, budget_cents, guest_list_enabled)
    values ('${MAYA}', 'Planning test ${stamp} (sample)', 'Wedding', '2027-06-12', 'Ann Arbor, MI', 100, 1500000, true) returning id;`);
  await sql(`insert into public.ai_requests (user_id, kind, event_id, input, output) values ('${MAYA}', 'plan', '${eid}', '{}',
    '{"summary":"Test estimate","categories":[{"name":"Venues","low":3000,"high":6000},{"name":"Catering","low":6000,"high":9000},{"name":"Photography","low":2000,"high":4000},{"name":"Photo booth","low":500,"high":900}],"checklist":[{"task":"Test planner task ${stamp}","when":"6 months before"}]}');
    insert into public.event_guests (event_id, name, party_size, status, attending) values
    ('${eid}', 'Party Four', 4, 'yes', 4), ('${eid}', 'Party Two', 2, 'yes', 2), ('${eid}', 'Party Three', 3, 'invited', null), ('${eid}', 'Party Gone', 1, 'no', 0);
    insert into public.event_timeline_items (event_id, start_time, title) values ('${eid}', '17:00', 'Test ceremony'), ('${eid}', '20:00', 'Private: pay the band');`);

  // ---------- Vendor filters (signed out)
  const anon = await page();
  await anon.goto(`${APP}/vendors?location=Ann%20Arbor&radius=10&sort=distance`);
  ok('radius filter shows in the summary', (await text(anon)).includes('within 10 miles of Ann Arbor'));
  const dists = (await anon.locator('.vendor-card').allInnerTexts()).map((t) => Number(t.match(/([\d.]+) mi\b/)?.[1])).filter((n) => !Number.isNaN(n));
  ok('nearest sort lists closer vendors first', dists.length > 1 && dists.every((d, i) => i === 0 || d >= dists[i - 1]) && dists.every((d) => d <= 10.5), dists.slice(0, 6));
  await anon.goto(`${APP}/vendors?max=1000&sort=price`);
  ok('price cap shows in the summary', (await text(anon)).includes('published price from $1,000 or less'));
  const prices = (await anon.locator('.vendor-card').allInnerTexts()).map((t) => t.match(/Published from \$([\d,]+)/)?.[1]).filter(Boolean).map(money);
  ok('price cap and lowest-price sort', prices.length > 0 && prices.every((n, i) => n <= 1000 && (i === 0 || n >= prices[i - 1])), prices.slice(0, 8));
  const count = async (q) => { await anon.goto(`${APP}/vendors${q}`); return Number((await text(anon)).match(/(\d+) vendors?/)?.[1]); };
  const all = await count(''); const ver = await count('?verified=1'); const pics = await count('?photos=1');
  ok('verified-only and has-photos narrow the list', ver > 0 && ver < all && pics > 0 && pics < all, { all, ver, pics });

  // ---------- Shortlist from vendor pages
  const p = await page();
  await signIn(p, 'maya@demo.test', `/vendors/${H}`);
  for (const v of [H, BARN, KITCHEN]) {
    await p.goto(`${APP}/vendors/${v}`);
    await p.selectOption(`#sl-ev-${v}`, eid);
    await p.getByRole('button', { name: 'Add to shortlist' }).click();
    await p.getByText('Added to the shortlist.').waitFor({ timeout: 10000 });
  }
  ok('organizer shortlists three vendors', true);

  // ---------- Invite a helper
  await p.goto(`${APP}/events/${eid}/team`);
  await p.fill('#inv-email', HELPER);
  await p.getByRole('button', { name: 'Create invite link' }).click();
  await p.getByText('Invite link created').waitFor({ timeout: 10000 });
  const invite = await p.locator('[data-copy*="/invites/"]').first().getAttribute('data-copy');
  ok('invite link created', /\/invites\/[0-9a-f-]{36}$/.test(invite ?? ''), invite);
  const h = await page();
  await signIn(h, HELPER, new URL(invite).pathname);
  await h.getByRole('button', { name: 'Accept invite' }).click();
  await h.waitForURL((u) => u.pathname === `/events/${eid}`, { timeout: 15000 });
  ok('helper accepts and lands on the event', true);

  // ---------- Votes and comments
  await h.goto(`${APP}/events/${eid}/shortlist`);
  const barnCard = (pg) => pg.locator('.shortlist-card', { hasText: 'Sample Orchard Barn' });
  await barnCard(h).getByRole('button', { name: /^Yes/ }).click();
  await barnCard(h).getByRole('button', { name: 'Yes 1' }).waitFor({ timeout: 10000 });
  await barnCard(h).locator('input[name=body]').fill(`Helper comment ${stamp}`);
  await barnCard(h).getByRole('button', { name: 'Post' }).click();
  await h.getByText(`Helper comment ${stamp}`).waitFor({ timeout: 10000 });
  ok('helper votes and comments', true);
  ok('helper cannot change the package or remove others’ picks', !(await h.getByRole('button', { name: 'Pick for package' }).count()) && !(await h.getByRole('button', { name: 'Remove' }).count()));
  await p.goto(`${APP}/events/${eid}/shortlist`);
  ok('organizer sees the helper’s vote and comment', await barnCard(p).getByRole('button', { name: 'Yes 1' }).isVisible() && await p.getByText(`Helper comment ${stamp}`).isVisible());

  // ---------- Compare
  await p.locator('.shortlist-card', { hasText: 'Sample Lantern Hall' }).locator('input[name=ids]').check();
  await barnCard(p).locator('input[name=ids]').check();
  await p.getByRole('button', { name: 'Compare selected' }).click();
  await p.waitForURL(/\/compare\?/, { timeout: 10000 });
  const cmp = await text(p);
  ok('compare page shows both vendors side by side', cmp.includes('Sample Lantern Hall') && cmp.includes('Sample Orchard Barn') && await p.locator('table').count() > 0);
  ok('compare rows cover price, policy and distance', /price/i.test(cmp) && /polic/i.test(cmp) && /mi\b/.test(cmp));
  await p.goto(`${APP}/events/${eid}/shortlist`);
  await barnCard(p).locator('input[name=ids]').check();
  await p.getByRole('button', { name: 'Compare selected' }).click();
  await p.getByText('Pick 2 to 4 vendors to compare.').waitFor({ timeout: 10000 });
  ok('comparing one vendor asks for 2 to 4', true);

  // ---------- Package and trade-offs
  await p.goto(`${APP}/events/${eid}/shortlist`);
  for (const name of ['Sample Lantern Hall', 'Sample Orchard Barn']) {
    const card = p.locator('.shortlist-card', { hasText: name });
    await card.getByRole('button', { name: 'Pick for package' }).click();
    await card.getByText('In package').waitFor({ timeout: 10000 });
  }
  ok('one pick per category: barn replaced the hall', !(await p.locator('.shortlist-card', { hasText: 'Sample Lantern Hall' }).getByText('In package').count()));
  await p.goto(`${APP}/events/${eid}/package`);
  const barnRow = p.locator('tr', { hasText: 'Sample Orchard Barn' });
  ok('unpriced pick asks for a planned amount', await barnRow.locator('input[name=planned]').isVisible());
  await barnRow.locator('input[name=planned]').fill('5000');
  await barnRow.getByRole('button', { name: 'Set' }).click();
  await p.locator('tr', { hasText: 'Sample Orchard Barn' }).getByText('$5,000').first().waitFor({ timeout: 10000 });
  ok('planned amount counts toward the package', true);
  const total = async () => money(await p.locator('.tradeoff-total .display-3').innerText());
  const t0 = await total();
  await p.locator('.tradeoff-rows li', { hasText: 'Photography' }).getByRole('radio', { name: 'Save' }).check();
  const t1 = await total();
  await p.locator('.tradeoff-rows li', { hasText: 'Photo booth' }).getByRole('checkbox').uncheck();
  const t2 = await total();
  await p.locator('#to-guests').fill('200');
  const t3 = await total();
  ok('trade-offs: Save level, skipping and guest count change the total', t1 === t0 - 1000 && t2 === t1 - 700 && t3 > t2, { t0, t1, t2, t3 });
  ok('over budget shows ways to save', await p.getByText('Ways to get back on budget').isVisible());
  await shot(p, 'package');

  // ---------- Shared tasks
  await h.goto(`${APP}/events/${eid}/tasks`);
  await h.fill('#tk-title', `Helper task ${stamp}`);
  const helperOpt = await h.locator('#tk-who option').filter({ hasNotText: /Maya|Unassigned|Nobody/ }).first().getAttribute('value');
  await h.selectOption('#tk-who', helperOpt);
  await h.getByRole('button', { name: 'Add task' }).click();
  await h.getByText('Task added.').waitFor({ timeout: 10000 });
  await h.getByRole('button', { name: `Mark done: Helper task ${stamp}` }).click();
  await h.getByRole('button', { name: `Reopen: Helper task ${stamp}` }).waitFor({ timeout: 10000 });
  ok('helper adds, owns and finishes a task', true);
  await p.goto(`${APP}/events/${eid}/tasks`);
  await p.getByRole('button', { name: 'Add planner tasks' }).click();
  await p.getByText(`Test planner task ${stamp}`, { exact: true }).waitFor({ timeout: 10000 });
  ok('organizer sees the helper task and imports planner tasks', await p.getByText(`Helper task ${stamp}`, { exact: true }).isVisible());

  // ---------- Style board
  await h.goto(`${APP}/events/${eid}/board`);
  await h.selectOption('#bd-section', 'flowers');
  await h.setInputFiles('#bd-photo', { name: 'peonies.png', mimeType: 'image/png', buffer: PNG });
  await h.fill('#bd-caption', `Peonies ${stamp}`);
  await h.getByRole('button', { name: 'Add to board' }).click();
  await h.getByText('Added to the board.').waitFor({ timeout: 15000 });
  await h.reload();
  const img = h.locator('.board-grid img').first();
  await img.waitFor({ timeout: 10000 });
  const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  ok('helper uploads a photo to the board', loaded && await h.getByText(`Peonies ${stamp}`).isVisible());
  const src = await img.getAttribute('src');
  const anonImg = await anon.request.get(`${APP}${src.startsWith('/') ? src : new URL(src).pathname}`);
  ok('board photos are private', anonImg.status() >= 400 || !(anonImg.headers()['content-type'] ?? '').startsWith('image/'), anonImg.status());

  // ---------- Event website
  await p.goto(`${APP}/events/${eid}/website`);
  await p.fill('#ws-intro', `Welcome test ${stamp}`);
  await p.getByRole('button', { name: 'Publish website' }).click();
  await p.getByText('Website is live.').waitFor({ timeout: 10000 });
  await p.locator('li', { hasText: 'Test ceremony' }).getByRole('button', { name: 'Hidden' }).click();
  await p.locator('li', { hasText: 'Test ceremony' }).getByRole('button', { name: 'Shown' }).waitFor({ timeout: 10000 });
  const site = await p.locator('[data-copy*="/e/"]').first().getAttribute('data-copy');
  await anon.goto(rel(site));
  const st = await anon.locator('body').innerText();
  ok('public website shows title, welcome and shown schedule', st.includes(`Planning test ${stamp}`) && st.includes(`Welcome test ${stamp}`) && st.includes('Test ceremony'));
  ok('website hides private items and guest names', !st.includes('pay the band') && !st.includes('Party Four') && !st.includes('Orchard Barn'));
  ok('without a guest link, website points to the invitation', st.includes('use the personal link in your invitation'));
  const [{ id: tok }] = await sql(`select rsvp_token from public.event_guests where event_id = '${eid}' and name = 'Party Two';`);
  await anon.goto(`${rel(site)}?g=${tok}`);
  await anon.getByRole('link', { name: 'Reply to your invitation' }).click();
  await anon.waitForURL((u) => u.pathname === `/rsvp/${tok}`, { timeout: 10000 });
  ok('guest website link opens their RSVP', true);
  await shot(anon, 'event-website', true);

  // ---------- Weather risk (NASA POWER; the stand-in in tests)
  await p.goto(`${APP}/events/${eid}`);
  await p.getByRole('button', { name: 'Check weather history' }).click();
  await p.getByText('Weather history updated from NASA POWER.').waitFor({ timeout: 20000 });
  const wx = await p.locator('section.weather').innerText();
  ok('weather panel shows NASA POWER history', /Data: NASA POWER/.test(wx) && /history, not a forecast/.test(wx) && /\d+ of \d+ years/.test(wx) && /°F/.test(wx), wx.slice(0, 300));
  await h.goto(`${APP}/events/${eid}`);
  ok('helper sees weather but cannot refresh it', (await h.locator('section.weather').innerText()).includes('NASA POWER') && !(await h.getByRole('button', { name: /Check (again|weather history)/ }).count()));

  // ---------- Seating
  await p.goto(`${APP}/events/${eid}/seating`);
  await p.fill('#tb-count', '2');
  await p.fill('#tb-seats', '4');
  await p.getByRole('button', { name: 'Add', exact: true }).click();
  await p.getByText('Added 2 tables.').waitFor({ timeout: 10000 });
  ok('seating counts people who are coming or have not replied', (await text(p)).includes('9 people to seat, 8 seats at 2 tables') && await p.getByText('You need 1 more seats.').isVisible());
  await p.getByRole('button', { name: 'Arrange automatically' }).click();
  await p.getByText('Seated 2 parties. 1 did not fit').waitFor({ timeout: 10000 });
  ok('auto-arrange seats parties that fit', await p.getByText('Not seated (1)').isVisible());
  const gone = await p.locator('main').innerText();
  ok('guests who said no are left off the chart', !gone.includes('Party Gone'));
  const [{ id: t2id }] = await sql(`select id from public.event_tables where event_id = '${eid}' order by created_at, name desc limit 1;`);
  const row = p.locator('li.seat-guest', { hasText: 'Party Two' });
  await row.locator('select').selectOption(t2id);
  await row.getByRole('button', { name: 'Move' }).click();
  await p.waitForTimeout(1500);
  const [{ id: seatedAt }] = await sql(`select coalesce(table_id::text, 'none') from public.event_guests where event_id = '${eid}' and name = 'Party Two';`);
  ok('organizer moves a guest to a table', seatedAt === t2id, seatedAt);
  await h.goto(`${APP}/events/${eid}/seating`);
  ok('helper sees the chart read-only', (await text(h)).includes('Not seated') && !(await h.getByRole('button', { name: 'Move' }).count()));

  // ---------- Website offline
  await p.goto(`${APP}/events/${eid}/website`);
  await p.getByRole('button', { name: 'Take the website offline' }).click();
  await p.getByRole('button', { name: 'Publish website' }).waitFor({ timeout: 10000 });
  const off = await anon.goto(rel(site));
  ok('offline website is gone', off.status() === 404);
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  if (eid) await sql(`delete from public.events where id = '${eid}';`).catch(() => {});
  await sql(`delete from auth.users where email = '${HELPER}';`).catch(() => {});
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
