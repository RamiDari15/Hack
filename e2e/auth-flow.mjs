// Account workflow: planner and vendor doors, sign up, sign in, wrong password, sign out,
// redirects back to the page asked for, forgot password via the local Mailpit inbox, new password.
// Usage: APP_URL=http://localhost:3100 node e2e/auth-flow.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';

const APP = process.env.APP_URL || 'http://localhost:3100';
const MAIL = process.env.MAILPIT_URL || 'http://127.0.0.1:55324';
const DB_CONTAINER = process.env.DB_CONTAINER || 'supabase_db_vendora';
const stamp = Date.now();
const P = `auth-planner-${stamp}@example.test`;
const V = `auth-vendor-${stamp}@example.test`;
const PW = 'first-password-123';
const PW2 = 'second-password-456';
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : info); };
const sql = (q) => execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: q, encoding: 'utf8' }).trim();
const path = (p) => new URL(p.url()).pathname;
const seen = async (loc, t = 10000) => loc.waitFor({ timeout: t }).then(() => true, () => false);

async function submit(p, email, pw) {
  await p.fill('#email', email);
  if (pw != null) await p.fill('#password', pw);
  await p.click('main button[type=submit]');
}
async function resetLink(email, after) {
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
  return null;
}

const browser = await chromium.launch();
const fresh = async () => (await browser.newContext()).newPage();
try {
  // Planner door: protected page sends you to sign-in and back afterwards
  const p = await fresh();
  await p.goto(`${APP}/events/new`);
  ok('protected page redirects to planner sign-in with next', path(p) === '/sign-in' && new URL(p.url()).searchParams.get('next') === '/events/new');
  await submit(p, P, PW);
  ok('unknown account gets a clear error', await seen(p.getByText('Email or password is wrong.')));
  await p.getByRole('button', { name: 'I’m new here' }).click();
  ok('create-account mode changes the heading', await seen(p.getByRole('heading', { name: 'Create your planner account' })));
  await submit(p, 'not-an-email', PW);
  ok('invalid email is rejected', await seen(p.getByText('Enter a valid email address.')));
  await submit(p, P, 'short');
  ok('short password is rejected', await seen(p.getByText('Use at least 8 characters')));
  await submit(p, P, PW);
  await p.waitForURL((u) => u.pathname === '/events/new', { timeout: 20000 });
  ok('sign-up returns to the page asked for', true);
  ok('header shows the signed-in state', await seen(p.getByRole('link', { name: 'Account' }).first()));
  const roles = sql(`select array_to_string(roles, ',') from public.profiles p join auth.users u on u.id = p.id where u.email = '${P}';`);
  ok('planner account has no vendor role', !roles.split(',').includes('vendor'), roles);
  await p.goto(`${APP}/sign-in`);
  ok('signed-in user skips the sign-in page', path(p) === '/dashboard');
  await p.locator('form[action="/auth/sign-out"] button').first().click();
  await p.waitForURL(`${APP}/`);
  await p.goto(`${APP}/dashboard`);
  ok('sign-out ends the session', path(p) === '/sign-in');

  // Duplicate account, then sign in
  await p.getByRole('button', { name: 'I’m new here' }).click();
  await submit(p, P, 'another-password-1');
  ok('same email cannot create a second account', await seen(p.getByText('already has an account')));
  await p.getByRole('button', { name: 'I have an account' }).click();
  await submit(p, P, 'wrong-password-1');
  ok('wrong password is rejected', await seen(p.getByText('Email or password is wrong.')));
  await submit(p, P.toUpperCase(), PW);
  await p.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20000 });
  ok('email is not case sensitive', true);
  await p.goto(`${APP}/sign-in?next=https://evil.example/steal`);
  ok('outside next links are ignored', path(p) === '/dashboard');
  await p.locator('form[action="/auth/sign-out"] button').first().click();
  await p.waitForURL(`${APP}/`);

  // Forgot password through the local inbox
  await p.goto(`${APP}/sign-in`);
  await p.getByRole('button', { name: 'Forgot password?' }).click();
  ok('reset mode shows its own heading', await seen(p.getByRole('heading', { name: 'Reset your password' })));
  const t = Date.now() - 1000;
  await submit(p, P);
  ok('reset request confirms without revealing accounts', await seen(p.getByText(`If ${P} has an account`)));
  const link = await resetLink(P, t);
  ok('reset email arrives in the local inbox', !!link);
  if (link) {
    await p.goto(link);
    await p.waitForURL((u) => u.pathname === '/account/password', { timeout: 20000 });
    await p.fill('#new-password', 'short');
    await p.getByRole('button', { name: 'Save password' }).click();
    ok('new password must be long enough', await seen(p.getByText('Use at least 8 characters.', { exact: true }).last()));
    await p.fill('#new-password', PW2);
    await p.getByRole('button', { name: 'Save password' }).click();
    ok('new password saved', await seen(p.getByText('Password updated.')));
    await p.locator('form[action="/auth/sign-out"] button').first().click();
    await p.waitForURL(`${APP}/`);
    await p.goto(`${APP}/sign-in`);
    await submit(p, P, PW);
    ok('old password stops working', await seen(p.getByText('Email or password is wrong.')));
    await submit(p, P, PW2);
    await p.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20000 });
    ok('new password signs in', true);
  }

  // Vendor door
  const v = await fresh();
  await v.goto(`${APP}/vendor/apply`);
  ok('vendor pages redirect to the vendor sign-in', path(v) === '/sign-in/vendor' && await seen(v.getByRole('heading', { name: 'Vendor sign in' })));
  await v.getByRole('button', { name: 'New vendor' }).click();
  ok('vendor create-account heading', await seen(v.getByRole('heading', { name: 'Create your vendor account' })));
  await submit(v, V, PW);
  await v.waitForURL((u) => u.pathname === '/vendor/apply', { timeout: 20000 });
  const vr = sql(`select array_to_string(roles, ',') from public.profiles p join auth.users u on u.id = p.id where u.email = '${V}';`);
  ok('new vendor gets the vendor role and lands on the application', vr.split(',').includes('vendor'), vr);
  const v2 = await fresh();
  await v2.goto(`${APP}/sign-in/vendor`);
  await submit(v2, V, PW);
  await v2.waitForURL((u) => u.pathname === '/vendor', { timeout: 20000 });
  ok('returning vendor lands on the vendor dashboard', true);
  // Planner signing in at the vendor door becomes a vendor too (one account, both roles)
  const pv = await fresh();
  await pv.goto(`${APP}/sign-in/vendor`);
  await submit(pv, P, PW2);
  await pv.waitForURL((u) => u.pathname === '/vendor', { timeout: 20000 });
  const pr = sql(`select array_to_string(roles, ',') from public.profiles p join auth.users u on u.id = p.id where u.email = '${P}';`);
  ok('a planner can open a vendor side with the same account', pr.split(',').includes('vendor') && pr.split(',').includes('customer'), pr);
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  try { sql(`delete from auth.users where email in ('${P}', '${V}');`); } catch {}
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
