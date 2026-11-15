import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Sends queued email alerts (quotes, messages, booking updates). Server only.
// The queue is filled by a database trigger on notifications and is readable only with the
// service role key, which never reaches the browser.
// Providers, chosen by EMAIL_PROVIDER:
//   mailpit: the local Supabase test inbox (nothing leaves the machine). Default in development.
//   resend:  Resend's HTTP API, needs RESEND_API_KEY and a verified EMAIL_FROM domain.
// With no provider configured, alerts stay queued and the app works as before.

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const FROM = () => process.env.EMAIL_FROM || 'Vendora <alerts@vendora.test>';

function provider() {
  const p = process.env.EMAIL_PROVIDER || (process.env.NODE_ENV !== 'production' ? 'mailpit' : '');
  if (p === 'resend' && process.env.RESEND_API_KEY) return 'resend';
  if (p === 'mailpit') return 'mailpit';
  return null;
}

function parseFrom(from) {
  const m = /^(.*)<([^>]+)>$/.exec(from.trim());
  return m ? { Name: m[1].trim(), Email: m[2].trim() } : { Email: from.trim() };
}

async function send(kind, { to, subject, text, html }) {
  if (kind === 'mailpit') {
    const base = (process.env.MAILPIT_URL || 'http://127.0.0.1:55324').replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ From: parseFrom(FROM()), To: [{ Email: to }], Subject: subject, Text: text, HTML: html, Tags: ['vendora-alert'] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`mailpit ${res.status}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM(), to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderAlert(subject, link) {
  const url = `${SITE()}${link || '/dashboard'}`;
  const text = `${subject}\n\nOpen it in Vendora: ${url}\n\nYou get these because email alerts are on. Turn them off on your account page: ${SITE()}/account`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#2b2140">
<p style="font-size:18px;font-weight:600">${esc(subject)}</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#2b2140;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open in Vendora</a></p>
<p style="font-size:12px;color:#5f5673">You get these because email alerts are on. <a href="${esc(SITE())}/account">Turn them off</a>.</p></div>`;
  return { text, html };
}

// Sends what is queued. Safe to call often; rows are claimed so two calls never double-send.
export async function drainEmailOutbox() {
  const kind = provider();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!kind || !key || !url) return { sent: 0, skipped: true };
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.rpc('claim_email_outbox', { max_rows: 20 });
  if (error) { console.error('email outbox', error.message); return { sent: 0 }; }
  let sent = 0;
  for (const r of rows ?? []) {
    try {
      await send(kind, { to: r.to_email, subject: r.subject, ...renderAlert(r.subject, r.link) });
      await admin.rpc('finish_email_outbox', { row_id: r.id });
      sent += 1;
    } catch (e) {
      await admin.rpc('finish_email_outbox', { row_id: r.id, failure: String(e.message ?? e) });
    }
  }
  return { sent };
}
