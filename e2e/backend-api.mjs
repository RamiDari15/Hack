// Local backend integration tests. No browser, hosted mutations, or paid model calls.
// Start e2e/mock-providers.mjs on 4011 and the app on 3101 with that provider URL.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const APP = process.env.BACKEND_TEST_URL || 'http://localhost:3101';
assert.equal(new URL(APP).hostname, 'localhost', 'Tests are local-only');
assert.equal(new URL(APP).port, '3101', 'Use the isolated backend test app');
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:55321');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const users = [];
const results = [];
let eventId, vendorId;
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, ...(condition ? {} : { detail }) });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${condition || !detail ? '' : ': '+detail}`);
}
function sql(query) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_vendora', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
async function account(role) {
  const email = `backend-${role}-${stamp}@example.test`;
  const password = crypto.randomBytes(24).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const user = created.data.user; users.push(user.id);
  const jar = new Map();
  const client = createServerClient(status.API_URL, status.ANON_KEY, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value, options }) => options?.maxAge === 0 ? jar.delete(name) : jar.set(name, value)),
  } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  return { user, client, jar, email };
}
async function app(path, account, body, method = 'POST') {
  return fetch(APP+path, { method, redirect: 'manual', headers: {
    ...(account ? { Cookie: cookieHeader(account.jar) } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}
async function deniedRead(client, table, field, value) {
  const result = await client.from(table).select('*').eq(field, value);
  return !result.error && result.data.length === 0;
}

try {
  const A = await account('organizer');
  const V = await account('vendor');
  const B = await account('outsider');
  const ADM = await account('admin');
  sql(`update public.profiles set roles='{customer,admin}' where id='${ADM.user.id}';`);
  check('real Auth sign-in creates valid SSR cookies', A.jar.size > 0 && (await A.client.auth.getUser()).data.user?.id === A.user.id);
  const profile = await A.client.from('profiles').select('roles').eq('id', A.user.id).single();
  check('Auth creates a customer profile', !profile.error && profile.data.roles.includes('customer'));
  const promotion = await A.client.from('profiles').update({ roles: ['admin'] }).eq('id', A.user.id);
  check('REST prevents self-promotion to admin', !!promotion.error);

  for (const path of ['/dashboard', '/events/new', '/planner', '/vendor', '/admin', '/bookings/00000000-0000-0000-0000-000000000000']) {
    const response = await app(path, null, undefined, 'GET');
    check(`signed-out ${path} requires sign-in`, response.status === 307 && response.headers.get('location')?.includes('/sign-in?next='));
  }
  const dashboard = await app('/dashboard', A, undefined, 'GET');
  check('SSR cookie session opens dashboard', dashboard.status === 200);
  for (const endpoint of ['/api/plan', '/api/discover']) {
    const response = await app(endpoint, null, {});
    check(`anonymous ${endpoint} is rejected`, response.status === 401, String(response.status));
  }
  for (const next of ['https://example.invalid', '//example.invalid', '/\\example.invalid']) {
    const response = await app('/auth/callback?next='+encodeURIComponent(next), null, undefined, 'GET');
    const target = new URL(response.headers.get('location'));
    check('auth callback rejects external redirect '+next, target.origin === APP && target.pathname === '/sign-in');
  }
  const noAdmin = await app('/admin', A, undefined, 'GET');
  check('ordinary customer cannot open admin page', noAdmin.status === 404);

  const event = await A.client.from('events').insert({ owner_id: A.user.id, title: 'Backend test event '+stamp,
    event_type: 'Wedding', event_date: '2027-06-12', location: 'Ann Arbor, MI', guest_count: 100, budget_cents: 2500000 }).select('id').single();
  assert.ifError(event.error); eventId = event.data.id;
  check('organizer creates an event through real PostgREST', !!eventId);
  check('anonymous cannot read the private event', await deniedRead(anon, 'events', 'id', eventId));
  check('another user cannot read the private event', await deniedRead(B.client, 'events', 'id', eventId));
  const hijack = await B.client.from('events').update({ title: 'Hijacked' }).eq('id', eventId).select('id');
  check('another user cannot edit the event', !hijack.error && hijack.data.length === 0);
  const privatePage = await app('/events/'+eventId, B, undefined, 'GET');
  check('SSR returns 404 for another user’s event', privatePage.status === 404);
  const save = await A.client.from('event_saved_results').insert({ event_id: eventId, title: 'Backend fixture', url: 'https://example.test/vendor' }).select('id').single();
  check('organizer saves an external result', !save.error);
  check('saved results stay private', await deniedRead(B.client, 'event_saved_results', 'event_id', eventId));
  const badUrl = await A.client.from('event_saved_results').insert({ event_id: eventId, title: 'Invalid', url: 'javascript:alert(1)' });
  check('unsafe saved-result URL is rejected', !!badUrl.error);

  const vendor = await V.client.from('vendors').insert({ owner_id: V.user.id, name: 'Backend Test Venue '+stamp,
    category: 'Venues', city: 'Ann Arbor, MI', verification_status: 'verified' }).select('id,verification_status').single();
  assert.ifError(vendor.error); vendorId = vendor.data.id;
  check('vendor cannot self-verify at signup', vendor.data.verification_status === 'pending');
  check('pending vendor is not publicly visible', await deniedRead(anon, 'vendors', 'id', vendorId));
  const forbidden = await A.client.from('event_vendors').insert({ event_id: eventId, vendor_id: vendorId });
  check('pending vendor cannot receive a booking', !!forbidden.error);
  const verified = await ADM.client.from('vendors').update({ verification_status: 'verified' }).eq('id', vendorId).select('verification_status').single();
  assert.ifError(verified.error);
  check('authorized admin can verify a vendor', verified.data.verification_status === 'verified');
  const pack = await V.client.from('vendor_packages').insert({ vendor_id: vendorId, title: 'Backend package', price_cents: 320000 }).select('id').single();
  check('vendor can create a genuine priced package', !pack.error);
  const booking = await A.client.from('event_vendors').insert({ event_id: eventId, vendor_id: vendorId }).select('id,status').single();
  assert.ifError(booking.error); const bid = booking.data.id;
  check('organizer sends an inquiry', booking.data.status === 'inquiry');
  check('unrelated user cannot read booking', await deniedRead(B.client, 'event_vendors', 'id', bid));
  const badQuote = await A.client.from('quotes').insert({ event_vendor_id: bid, amount_cents: 320000 });
  check('customer cannot forge a vendor quote', !!badQuote.error);
  const quote = await V.client.from('quotes').insert({ event_vendor_id: bid, amount_cents: 320000, description: 'Backend fixture quote' }).select('id').single();
  assert.ifError(quote.error);
  check('vendor writes a quote', !!quote.data.id);
  const message = await A.client.from('messages').insert({ event_vendor_id: bid, sender_id: A.user.id, body: 'Backend fixture message' }).select('id').single();
  check('booking party sends a message', !message.error);
  check('outsider cannot read messages', await deniedRead(B.client, 'messages', 'event_vendor_id', bid));
  const outsiderMessage = await B.client.from('messages').insert({ event_vendor_id: bid, sender_id: B.user.id, body: 'Unauthorized' });
  check('outsider cannot write messages', !!outsiderMessage.error);
  const selfAccept = await V.client.rpc('respond_to_quote', { q: quote.data.id, accept: true });
  check('vendor cannot accept their own quote', !!selfAccept.error);
  const accepted = await A.client.rpc('respond_to_quote', { q: quote.data.id, accept: true });
  check('organizer accepts the quote', !accepted.error);
  const confirmed = await A.client.from('event_vendors').update({ status: 'confirmed' }).eq('id', bid).select('status').single();
  check('organizer confirms accepted quote', !confirmed.error && confirmed.data.status === 'confirmed');
  const invoice = await V.client.from('invoices').insert({ event_vendor_id: bid, kind: 'deposit', amount_cents: 100000 }).select('id').single();
  assert.ifError(invoice.error);
  check('vendor creates an invoice', !!invoice.data.id);
  const fakePayment = await V.client.rpc('set_invoice_status', { i: invoice.data.id, s: 'paid' });
  check('vendor cannot mark invoice paid', !!fakePayment.error);
  check('outsider cannot read invoice', await deniedRead(B.client, 'invoices', 'id', invoice.data.id));
  const payment = await A.client.rpc('set_invoice_status', { i: invoice.data.id, s: 'paid' });
  check('organizer can record payment', !payment.error);
  const notices = await V.client.from('notifications').select('id,title').eq('user_id', V.user.id);
  check('inquiry and message notifications were created', !notices.error && notices.data.length >= 2);
  const forgedNotice = await B.client.from('notifications').insert({ user_id: A.user.id, title: 'Forged', link: '/' });
  check('user cannot forge another user’s notification', !!forgedNotice.error);
  const favorite = await A.client.from('favorites').insert({ user_id: A.user.id, vendor_id: vendorId });
  check('favorites persist', !favorite.error);
  check('favorites stay private', await deniedRead(B.client, 'favorites', 'user_id', A.user.id));

  for (const [path, body] of [['/api/plan', '{'], ['/api/plan', {}], ['/api/plan', {prompt:'x'.repeat(17000)}],
    ['/api/discover', {}], ['/api/discover', {query:'x'.repeat(301)}], ['/api/discover', {query:'x'.repeat(4500)}]]) {
    const response = await app(path, A, body);
    check(path+' rejects malformed or oversized input', response.status === 400, String(response.status));
  }
  const planned = await app('/api/plan', A, { prompt: 'Plan my test wedding', eventId });
  const plan = await planned.json();
  check('planner API returns a structured response', planned.status === 200 && plan.plan?.estimate === true && plan.eventId === eventId, String(planned.status));
  check('planner includes fees and contingency', plan.plan?.categories.some((c) => c.name === 'Contingency') && plan.plan?.categories.some((c) => c.name === 'Taxes and service fees'));
  const savedPlan = await A.client.from('ai_requests').select('id').eq('event_id', eventId).eq('kind','plan');
  check('planner response is saved to the event', !savedPlan.error && savedPlan.data.length === 1);
  check('AI records stay private', await deniedRead(B.client, 'ai_requests', 'event_id', eventId));
  const searched = await app('/api/discover', A, { query: 'Test venues near Ann Arbor' });
  const search = await searched.json();
  check('search API returns structured sourced results', searched.status === 200 && search.results?.length === 2, String(searched.status));
  check('search removes invented domains', search.results?.every((r) => !r.url.includes('not-a-source.test') && r.source === 'external' && r.needsConfirmation));
  const hidden = await app('/api/plan', B, { prompt: 'Plan a birthday', eventId });
  const hiddenPlan = await hidden.json();
  check('planner cannot attach output to another user’s event', hidden.status === 200 && hiddenPlan.eventId === null);

  // Quota tests use local stand-ins only, never paid calls or hosted records.
  const usage = await A.client.from('ai_requests').select('id', { count: 'exact', head: true });
  const fill = Array.from({ length: 19-usage.count }, () => ({ user_id: A.user.id, kind: 'plan', input: { fixture: true }, output: {} }));
  assert.ifError((await admin.from('ai_requests').insert(fill)).error);
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => app('/api/plan', A, { prompt: 'Quota concurrency fixture' })));
  const successful = concurrent.filter((r) => r.status === 200).length;
  check('daily quota is atomic under concurrent requests', successful <= 1, `${successful} requests succeeded with only 1 allowance left`);
  const limited = await app('/api/discover', A, { query: 'At quota' });
  check('daily quota rejects subsequent requests', limited.status === 429, String(limited.status));
  const independent = await app('/api/discover', B, { query: 'Independent quota fixture' });
  check('daily quota is isolated per user', independent.status === 200);

  const logoutGet = await app('/auth/sign-out', A, undefined, 'GET');
  check('GET cannot sign a user out', logoutGet.status === 405);
  const logout = await app('/auth/sign-out', A, undefined);
  check('POST signs out and redirects home', logout.status === 303 && logout.headers.get('set-cookie')?.includes('Max-Age=0'));
} catch (error) {
  check('backend flow completed without exceptions', false, error.message);
} finally {
  // Delete only fixtures created by this exact run, never existing users or data.
  if (eventId) await admin.from('events').delete().eq('id', eventId);
  if (vendorId) await admin.from('vendors').delete().eq('id', vendorId);
  for (const uid of users) {
    const removed = await admin.auth.admin.deleteUser(uid);
    check('temporary test account removed', !removed.error);
  }
  const report = { timestamp: new Date().toISOString(), environment: 'isolated local app; real local Supabase; mocked OpenAI',
    passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
  fs.writeFileSync('/private/tmp/vendora-backend-api-results.json', JSON.stringify(report, null, 2));
  console.log(`\n${report.passed} passed, ${report.failed} failed`);
  process.exitCode = report.failed ? 1 : 0;
}
