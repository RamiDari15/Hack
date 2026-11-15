// Direct API checks against local Supabase (PostgREST + RLS), bypassing the app entirely.
// Signs a short-lived JWT with the LOCAL development JWT secret (public demo value from `supabase start`).
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const URL_ = process.env.SUPABASE_URL || 'http://127.0.0.1:55321';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.LOCAL_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const psql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_vendora', 'psql', '-U', 'postgres', '-At'], { input: q, encoding: 'utf8' }).trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 });
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
const api = (path, token, init = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) } });
let pass = 0, fail = 0;
const ok = (n, c, i = '') => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : i); };

const [a, b] = psql(`select id from auth.users where email like 'planner-%' order by created_at desc limit 1; select id from auth.users where email like 'other-%' order by created_at desc limit 1;`).split('\n');
const ev = psql(`select id from public.events where owner_id = '${a}' order by created_at desc limit 1;`);

let r = await (await api(`events?id=eq.${ev}`, null)).json(); ok('anonymous cannot read events', Array.isArray(r) && r.length === 0, JSON.stringify(r));
r = await (await api(`events?id=eq.${ev}`, jwt(b))).json(); ok('user B cannot read A\'s event', Array.isArray(r) && r.length === 0, JSON.stringify(r));
r = await (await api(`event_saved_results?event_id=eq.${ev}`, jwt(b))).json(); ok('user B cannot read A\'s saved results', Array.isArray(r) && r.length === 0);
r = await (await api(`ai_requests?event_id=eq.${ev}`, jwt(b))).json(); ok('user B cannot read A\'s AI estimates', Array.isArray(r) && r.length === 0);
let res = await api('event_saved_results', jwt(b), { method: 'POST', body: JSON.stringify({ event_id: ev, title: 'x', url: 'https://x.test' }) });
ok('user B cannot write into A\'s event', res.status >= 400, res.status);
res = await api(`events?id=eq.${ev}`, jwt(b), { method: 'PATCH', body: JSON.stringify({ title: 'hacked' }) });
r = await res.json(); ok('user B cannot edit A\'s event', Array.isArray(r) && r.length === 0, JSON.stringify(r));
res = await api(`profiles?id=eq.${a}`, jwt(a), { method: 'PATCH', body: JSON.stringify({ roles: ['admin'] }) });
ok('user A cannot make themselves admin', res.status >= 400, res.status);
r = await (await api(`events?id=eq.${ev}`, jwt(a))).json(); ok('owner A can read own event', r.length === 1 && r[0].title !== 'hacked');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
