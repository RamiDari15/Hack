// Every internal link on the homepage (header, CTAs, sections, footer) must resolve.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const APP = process.env.APP_URL || 'http://localhost:3100';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(APP + '/');
const hrefs = [...new Set(await p.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href'))))];
let bad = 0;
for (const h of hrefs) {
  const r = await fetch(APP + h, { redirect: 'manual' });
  const okStatus = r.status === 200 || (r.status === 307 && (r.headers.get('location') || '').includes('/sign-in'));
  if (!okStatus) bad++;
  console.log(okStatus ? 'PASS' : 'FAIL', r.status, h, r.status === 307 ? '-> sign-in (protected)' : '');
}
const ctas = await p.$$eval('main .btn', (as) => as.map((a) => `${a.textContent.trim()} -> ${a.getAttribute('href')}`));
console.log('\nHomepage buttons:\n' + ctas.join('\n'));
await b.close(); console.log(`\n${hrefs.length - bad} of ${hrefs.length} links resolve`); process.exit(bad ? 1 : 0);
