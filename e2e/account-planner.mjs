// Planner form (structured details feed the AI plan, sized to the budget) and the account page
// (personal to-do list, assigned event tasks). Uses the local OpenAI stand-in when OPENAI_BASE_URL points at it.
// Usage: APP_URL=http://localhost:3100 node e2e/account-planner.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { signInWith } from './auth.mjs';

const APP = process.env.APP_URL || 'http://localhost:3100';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:4010';
const DB_CONTAINER = process.env.DB_CONTAINER || 'supabase_db_vendora';
const stamp = Date.now();
const U = `acct-${stamp}@example.test`;
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : info); };
const sql = (q) => execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: q, encoding: 'utf8' }).trim();
const seen = (loc, t = 10000) => loc.waitFor({ timeout: t }).then(() => true, () => false);

const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await signInWith(p, APP, U, '/planner');

  // Planner form
  await p.selectOption('#type', 'Wedding');
  await p.fill('#date', '2027-06-15');
  await p.fill('#loc', 'Ann Arbor, MI');
  await p.fill('#guests', '300');
  await p.fill('#budget', '222000');
  ok('budget is formatted as you type', (await p.inputValue('#budget')) === '222,000');
  ok('budget per guest is shown', await seen(p.getByText('About $740 per guest')));
  await p.getByRole('radio', { name: 'Outdoor' }).check();
  for (const s of ['Elegant', 'Garden']) await p.getByRole('button', { name: s, exact: true }).click();
  for (const s of ['Food and drink', 'Photos and video', 'Music and dancing']) await p.getByRole('button', { name: s, exact: true }).click();
  ok('priorities are limited to three', await p.getByRole('button', { name: 'Venue', exact: true }).isDisabled());
  const using = await p.locator('.planner-using').innerText();
  ok('form shows what the AI plan will use', /300 guests/.test(using) && /\$222,000/.test(using) && /outdoor/.test(using) && /Elegant, Garden/.test(using), using);
  await p.getByRole('button', { name: 'Build estimate' }).click();
  ok('plan builds without typing a request', await seen(p.locator('.budget-fit'), 30000), await p.locator('.notice-error').textContent().catch(() => ''));
  ok('result shows how it fits the budget', /Against your \$222,000 budget/.test(await p.locator('.budget-fit').innerText()));
  const input = await (await fetch(`${MOCK}/last-plan-input`)).text();
  ok('every field reaches the planner', ['"guests":"300"', '"budget":"222000"', '"setting":"outdoor"', 'Elegant, Garden', '"priorities":["Food and drink","Photos and video","Music and dancing"]', '"hours":5'].every((x) => input.includes(x)), input.slice(0, 600));
  const recs = await p.locator('.rec-list li').allInnerTexts();
  ok('recommends a real listed business and drops invented ones', recs.some((t) => t.includes('Sample Lantern Hall') && t.includes('Verified')) && !recs.some((t) => t.includes('Made Up Hall')), recs);
  ok('planner gets the public directory listings to recommend from', input.includes('Businesses listed on Vendora (public listings, not verified)'));
  await p.selectOption('#type', 'Quinceañera');
  ok('planner offers many event types', (await p.locator('#type option').count()) >= 30);
  ok('planner is told to size the plan to the budget', /Plan targets:\nBudget \$222,000, about \$740 per guest for 300 guests/.test(input));

  // Account page and to-do list
  await p.goto(`${APP}/account`);
  ok('account page greets the user', await seen(p.getByRole('heading', { name: /^Hi, / })));
  await p.fill('#todo-title', `Book a tasting ${stamp}`);
  await p.fill('#todo-due', '2020-01-01');
  await p.getByRole('button', { name: 'Add to-do' }).click();
  const row = p.locator('.task-list li', { hasText: `Book a tasting ${stamp}` });
  ok('to-do added', await seen(row));
  ok('past due date is flagged late', await row.getByText(/Late, was due/).isVisible());
  ok('stat counts open to-dos', /1/.test(await p.locator('.stat-strip div', { hasText: 'Open to-dos' }).locator('dd').innerText()));
  await p.fill('#todo-title', `Second ${stamp}`);
  await p.getByRole('button', { name: 'Add to-do' }).click();
  await seen(p.locator('.task-list li', { hasText: `Second ${stamp}` }));
  await p.getByRole('button', { name: `Mark done: Book a tasting ${stamp}` }).click();
  ok('finished items move to Finished', await seen(p.getByText('Finished (1)')));
  await p.getByText('Finished (1)').click();
  await p.getByRole('button', { name: `Reopen: Book a tasting ${stamp}` }).click();
  await seen(p.getByRole('button', { name: `Mark done: Book a tasting ${stamp}` }));
  ok('finished items can be reopened', !(await p.getByText('Finished (1)').count()));
  await p.getByRole('button', { name: `Delete Second ${stamp}` }).click();
  ok('to-do deleted', await p.locator('.task-list li', { hasText: `Second ${stamp}` }).waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false));
  const n = sql(`select count(*) from public.user_todos t join auth.users u on u.id = t.user_id where u.email = '${U}';`);
  ok('to-dos are saved in the database', n === '1', n);
  await p.reload();
  ok('to-dos persist after reload', await seen(p.locator('.task-list li', { hasText: `Book a tasting ${stamp}` })));
  ok('account links to password and sign out', await p.getByRole('link', { name: 'Change password' }).isVisible() && await p.locator('aside form[action="/auth/sign-out"] button').isVisible());

  // Another user never sees them
  const q = await (await browser.newContext()).newPage();
  await signInWith(q, APP, 'maya@demo.test', '/account');
  ok('other users do not see my to-dos', !(await q.getByText(`Book a tasting ${stamp}`).count()));
  ok('event tasks assigned to me appear on the account', await seen(q.getByRole('heading', { name: 'Assigned to you on events' })));
} catch (e) {
  ok('flow completed without exceptions', false, e.message);
} finally {
  try { sql(`delete from auth.users where email = '${U}';`); } catch {}
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
}
