// End-to-end flow against a running app + local Supabase (npx supabase start).
// Usage: APP_URL=http://localhost:3100 node e2e/flow.mjs
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
const A = `planner-${stamp}@example.test`;
const B = `other-${stamp}@example.test`;
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : info); };

const signIn = (page, email, next = '/dashboard') => signInWith(page, APP, email, next);

// Test-only seeding through psql in the local database container (never against a hosted project).
const DB_CONTAINER = process.env.DB_CONTAINER || 'supabase_db_vendora';
const sql = async (query) => {
  const out = execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map((id) => ({ id }));
};

const browser = await chromium.launch();
try {
  // 1. Sign up with email and password and land on the dashboard
  const ctxA = await browser.newContext();
  const pa = await ctxA.newPage();
  ok('sign up with email and password lands on dashboard', (await signIn(pa, A)) === 'signed-up' && pa.url().endsWith('/dashboard'));
  ok('header shows signed-in state', await pa.getByRole('link', { name: 'Your events' }).first().isVisible());

  // 2. Create and save an event
  await pa.goto(`${APP}/events/new`);
  await pa.fill('#title', 'E2E Garden Wedding');
  await pa.selectOption('#event_type', 'Wedding');
  await pa.fill('#event_date', '2027-06-12');
  await pa.fill('#location', 'Ann Arbor, MI');
  await pa.fill('#guest_count', '150');
  await pa.fill('#budget', '25000');
  await pa.click('main button[type=submit]');
  await pa.waitForURL(/\/events\/[0-9a-f-]{36}/);
  const eventUrl = pa.url().split('?')[0];
  const eventId = eventUrl.split('/').pop();
  ok('event created and opened', await pa.getByRole('heading', { name: 'E2E Garden Wedding' }).isVisible());

  // 3. Planner, saved to the event
  await pa.goto(`${APP}/planner?event=${eventId}`);
  await pa.fill('#prompt', 'Help me plan a 150-person outdoor wedding within a $25,000 budget.');
  await pa.click('button:has-text("Build my plan")');
  await pa.getByRole('link', { name: 'Open the event' }).waitFor({ timeout: 90000 }).catch(() => {});
  const plannerError = await pa.locator('.notice-error').textContent().catch(() => null);
  ok('planner returns an estimate', await pa.getByRole('link', { name: 'Open the event' }).isVisible(), plannerError);
  ok('planner output shows a plan', await pa.locator('article.plan').first().isVisible());

  // 4. Web search, then save a result to the event
  await pa.goto(`${APP}/discover`);
  await pa.fill('#q', 'outdoor wedding venues with string lights near Ann Arbor');
  await pa.click('form[role=search] button[type=submit]');
  await pa.locator('article.result-card').first().waitFor({ timeout: 30000 }).catch(() => {});
  const nExt = await pa.locator('article.result-card').count();
  ok('web search returns results', nExt > 0, await pa.locator('.notice-error').textContent().catch(() => ''));
  ok('every external result is badged External, confirm', nExt > 0 && (await pa.locator('article.result-card .badge-warn', { hasText: 'External' }).count()) === nExt);
  ok('links the search never returned are dropped', (await pa.getByText('Invented link the search never returned').count()) === 0);
  ok('verified column is separate from external column', await pa.locator('#ext-h').isVisible() && (await pa.locator('#ver-h').count() === 0 || await pa.locator('#ver-h').isVisible()));
  const firstTitle = (await pa.locator('article.result-card .title').first().textContent())?.trim();
  await pa.locator('article.result-card').first().locator('button:has-text("Save to event")').click();
  await pa.getByText('Saved to your event, marked as external.').waitFor({ timeout: 15000 });
  ok('result saved to event', true);

  // 5. Seed a verified vendor (owned by user B) with a quote, to check estimate vs quote labels
  // done after B signs up below.

  // 6. Sign out, sign back in, confirm everything persisted
  await pa.goto(`${APP}/dashboard`);
  await pa.locator('header details.acct summary').click(); await pa.locator('header .acct-menu form button').click();
  await pa.waitForURL(`${APP}/`);
  await pa.goto(`${APP}/dashboard`);
  ok('after sign-out, dashboard redirects to sign-in', pa.url().includes('/sign-in'));
  await pa.fill('#email', A);
  await pa.fill('#password', 'wrong-password-99');
  await pa.click('main button[type=submit]');
  ok('wrong password is rejected', await pa.getByText('Email or password is wrong.').waitFor({ timeout: 10000 }).then(() => true, () => false));
  await pa.getByRole('button', { name: 'I’m new here' }).click();
  await pa.fill('#email', A);
  await pa.fill('#password', 'short');
  await pa.click('main button[type=submit]');
  ok('short passwords are rejected', await pa.getByText('Use at least 8 characters').isVisible({ timeout: 5000 }));
  await pa.fill('#password', 'another-password-1');
  await pa.click('main button[type=submit]');
  ok('cannot create a second account for the same email', await pa.getByText('already has an account').waitFor({ timeout: 10000 }).then(() => true, () => false));
  await signIn(pa, A, '/dashboard');
  ok('event persisted after signing back in', await pa.getByText('E2E Garden Wedding').isVisible());
  await pa.goto(eventUrl);
  ok('AI estimate persisted on event', await pa.locator('.table .source', { hasText: 'Ballpark' }).first().isVisible());
  ok('saved web result persisted, still marked external', await pa.locator('#saved-h').isVisible()
    && await pa.getByText(firstTitle).isVisible()
    && await pa.locator('section:has(#saved-h) .badge', { hasText: 'External, confirm' }).first().isVisible());

  // 7. A second user cannot see A's event
  const ctxB = await browser.newContext();
  const pb = await ctxB.newPage();
  await signIn(pb, B);
  const resp = await pb.goto(eventUrl);
  ok('other user gets 404 on private event', resp.status() === 404, `status ${resp.status()}`);
  await pb.goto(`${APP}/dashboard`);
  ok("other user's dashboard does not list it", !(await pb.getByText('E2E Garden Wedding').isVisible()));

  // 8. Vendor quote replaces the estimate row, labeled differently
  if (SEED) {
    const seeded = await sql(`
      with b as (select id from auth.users where email = '${B}'),
      v as (insert into public.vendors (owner_id, name, category, city) select id, 'E2E Test Venue', 'Venues', 'Ann Arbor, MI' from b returning id)
      select id from v;`);
    const vid = seeded?.[0]?.id;
    await sql(`update public.profiles set roles = '{customer,admin}' where id = (select id from auth.users where email = '${B}');`);
    // The verification guard only lets admins verify; run as B (now admin) through the trigger path.
    await sql(`begin; select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email='${B}'), 'role', 'authenticated')::text, true); set local role authenticated; update public.vendors set verification_status = 'verified' where id = '${vid}'; commit;`);
    await pa.goto(`${APP}/vendors/${vid}`);
    await pa.selectOption('#rq-event', eventId);
    await pa.check('input[name=confirm]');
    await pa.click('button:has-text("Send inquiry")');
    await pa.getByText('Inquiry sent.').waitFor({ timeout: 15000 });
    await sql(`insert into public.quotes (event_vendor_id, amount_cents, description) select id, 580000, 'E2E quote' from public.event_vendors where event_id = '${eventId}' and vendor_id = '${vid}';`);
    await pa.goto(eventUrl);
    const quoteRow = pa.locator('.table tr', { hasText: 'Vendor quote' });
    ok('vendor quote row labeled Vendor quote', await quoteRow.first().isVisible());
    ok('remaining rows still labeled AI estimate', (await pa.locator('.table .source', { hasText: 'Ballpark' }).count()) > 0);
    ok('quote amount shown', await quoteRow.first().getByText('$5,800').isVisible());
    ok('booking status moved to Quote received', await pa.locator('.booking-list .badge', { hasText: 'Quote received' }).first().isVisible());
  } else {
    ok('vendor quote labeling (seeding turned off)', false, 'skipped');
  }

  // Separate doors: vendors sign up at /sign-in/vendor and go straight to the application
  const pv = await (await browser.newContext()).newPage();
  await pv.goto(`${APP}/vendor`);
  ok('signed-out vendor area goes to the vendor sign-in', new URL(pv.url()).pathname === '/sign-in/vendor' && await pv.getByRole('heading', { name: 'Vendor sign in' }).isVisible());
  ok('vendor sign-in links to the planner sign-in', await pv.getByRole('link', { name: 'Sign in as a planner' }).isVisible());
  await pv.goto(`${APP}/sign-in/vendor?mode=sign-up`);
  ok('vendor sign-up page is labeled for vendors', await pv.getByRole('heading', { name: 'Create your vendor account' }).isVisible() && await pv.getByText('Vendor account', { exact: true }).isVisible());
  const VND = `door-vendor-${stamp}@example.test`;
  await pv.fill('#email', VND);
  await pv.fill('#password', 'test-password-1234');
  await pv.click('main button[type=submit]');
  await pv.waitForURL((u) => u.pathname === '/vendor/apply', { timeout: 20000 });
  const [{ id: roles }] = await sql(`select array_to_string(roles, ',') from public.profiles p join auth.users u on u.id = p.id where u.email = '${VND}';`);
  ok('new vendor lands on the application with the vendor role', roles.split(',').includes('vendor'), roles);
  const pp = await (await browser.newContext()).newPage();
  await pp.goto(`${APP}/sign-in`);
  ok('planner sign-in links to the vendor door', await pp.getByRole('heading', { name: 'Sign in to plan' }).isVisible() && await pp.getByRole('link', { name: 'Vendor sign in' }).isVisible());
  await sql(`delete from auth.users where email = '${VND}';`);
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
