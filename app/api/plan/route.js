import { NextResponse } from 'next/server';
import { fetchWithTimeout, jsonError, readJson, requireUserWithinLimit } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/categories';
import { UUID_RE } from '@/lib/format';
import { readBudgetOption, publishedRate } from '@/lib/vendor-pricing';

// AI planner. Server only: OPENAI_API_KEY never reaches the browser.
// Uses the OpenAI Responses API with a strict JSON schema, so the UI renders structured,
// labeled estimates instead of free text. Grounded in the user's event and in verified
// Vendora vendors near the event; it never claims availability or verification.

const SYSTEM = `You are Vendora's event planning assistant.
Produce a budget ESTIMATE split by category for the event described. Rules:
- Every amount is a rough estimate range in US dollars (low and high). Never present an amount as a price or a quote.
- Always include separate rows for taxes and service fees, tips, delivery and travel, setup and cleanup, and a contingency.
- If the user gives a total budget, keep the sum of the high values at or below it where possible, and say so in assumptions if it is not realistic.
- Only recommend vendors listed under "Verified vendors on Vendora". Never invent vendor names, availability, ratings, or verification status.
- Calibrate every range with "Price references". Published prices are what local businesses list publicly and may be out of date; budget-guide ranges are Vendora's typical planning ranges. Scale per-person and per-hour figures by the guest count and event length.
- When a published price shaped a row, you may name that business in the row's notes as "published rate from <name>". Never call a reference a quote, and never say a business is available or verified.
- State every assumption you make (season, region, service style).
- Keep the checklist practical, ordered by when it should happen before the event.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'assumptions', 'categories', 'missing_items', 'cost_saving_ideas', 'checklist'],
  properties: {
    summary: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' } },
    categories: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'low', 'high', 'notes'],
        properties: { name: { type: 'string' }, low: { type: 'number' }, high: { type: 'number' }, notes: { type: 'string' } },
      },
    },
    missing_items: { type: 'array', items: { type: 'string' } },
    cost_saving_ideas: { type: 'array', items: { type: 'string' } },
    checklist: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['task', 'when'], properties: { task: { type: 'string' }, when: { type: 'string' } } },
    },
  },
};

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizePlan(p) {
  const num = (n) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
  const list = (a, max = 12) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, max).map((x) => x.slice(0, 300)) : []);
  return {
    summary: clean(p.summary, 800),
    assumptions: list(p.assumptions),
    categories: (Array.isArray(p.categories) ? p.categories : []).slice(0, 20).map((c) => {
      const low = num(c.low), high = num(c.high);
      return { name: clean(c.name, 80) || 'Other', low: Math.min(low, high), high: Math.max(low, high), notes: clean(c.notes, 200) };
    }),
    missing_items: list(p.missing_items),
    cost_saving_ideas: list(p.cost_saving_ideas),
    checklist: (Array.isArray(p.checklist) ? p.checklist : []).slice(0, 20).map((c) => ({ task: clean(c.task, 160), when: clean(c.when, 80) })),
    estimate: true,
  };
}

// Local published rates and category budget-guide ranges, so estimates start from real numbers.
async function priceReferences(supabase, location, city) {
  const fields = 'name, category, city, vendor_packages(title, price_cents, description)';
  let rows = [];
  if (/ann\s+arbor/i.test(location)) {
    ({ data: rows } = await supabase.rpc('vendors_within_radius', { center_latitude: 42.2808, center_longitude: -83.7430, radius_miles: 25 }).select(fields).limit(200));
  } else if (city) {
    ({ data: rows } = await supabase.from('vendors').select(fields).ilike('city', `%${city}%`).limit(200));
  }
  let scope = 'near the event';
  if ((rows ?? []).length < 5) {
    ({ data: rows } = await supabase.from('vendors').select(fields).eq('directory_listed', true).limit(300));
    scope = 'across the US (few local listings)';
  }
  const published = [];
  const guide = {};
  const perCategory = {};
  for (const v of rows ?? []) {
    for (const p of v.vendor_packages ?? []) {
      const b = readBudgetOption(p.description);
      if (b) {
        const g = (guide[v.category] ??= { unit: b.unit, tiers: {} });
        if (b.unit !== g.unit) continue;
        const t = (g.tiers[b.title] ??= { min: Infinity, max: 0 });
        t.min = Math.min(t.min, b.min_cents);
        t.max = Math.max(t.max, b.max_cents);
        continue;
      }
      const rate = publishedRate({ priceCents: p.price_cents, note: p.description ?? '' });
      const n = (perCategory[v.category] ?? 0);
      if (rate && n < 4 && published.length < 40) { perCategory[v.category] = n + 1; published.push(`- ${v.name} (${v.category}, ${v.city ?? 'city not listed'}): "${p.title}" ${rate}`); }
    }
  }
  const usd = (c) => `$${Math.round(c / 100).toLocaleString('en-US')}`;
  const guideLines = Object.entries(guide).map(([cat, g]) => `- ${cat} (per ${g.unit}): ${Object.entries(g.tiers).map(([tier, t]) => `${tier} ${usd(t.min)}-${usd(t.max)}`).join(', ')}`);
  return [
    `Published prices from local businesses, ${scope}:`, ...(published.length ? published : ['- None published.']),
    `Budget-guide ranges by category, ${scope}:`, ...(guideLines.length ? guideLines : ['- None available.']),
  ].join('\n');
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return jsonError('The AI planner is not configured yet. Add OPENAI_API_KEY and OPENAI_MODEL.', 503);

  const gate = await requireUserWithinLimit();
  if (gate.error) return gate.error;
  const { supabase, user } = gate;

  const { body, error } = await readJson(request);
  if (error) return jsonError(error, 400);
  const prompt = clean(body?.prompt, 2000);
  if (!prompt) return jsonError('Describe your event in under 2,000 characters.', 400);

  // Event details: from the user's saved event when given (RLS checks ownership), else from the form.
  let eventId = null;
  let event = {
    type: EVENT_TYPES.includes(body?.event?.type) ? body.event.type : 'Other',
    date: clean(body?.event?.date, 10), location: clean(body?.event?.location, 160),
    guests: clean(String(body?.event?.guests ?? ''), 7), budget: clean(String(body?.event?.budget ?? ''), 12), style: clean(body?.event?.style, 160),
  };
  if (body?.eventId && UUID_RE.test(body.eventId)) {
    const { data } = await supabase.from('events').select('id, event_type, event_date, location, guest_count, budget_cents, style').eq('id', body.eventId).maybeSingle();
    if (data) {
      eventId = data.id;
      event = { type: data.event_type, date: data.event_date ?? '', location: data.location ?? '', guests: String(data.guest_count ?? ''), budget: data.budget_cents == null ? '' : String(data.budget_cents / 100), style: data.style ?? '' };
    }
  }

  // Grounding: a short list of verified vendors, filtered by city when one is given.
  let vq = supabase.from('vendors').select('name, category, city, vendor_packages(title, price_cents)').eq('verification_status', 'verified').limit(15);
  const city = event.location.split(',')[0].replace(/[%_,()]/g, '').trim();
  if (city) vq = vq.ilike('city', `%${city}%`);
  const { data: vendors } = await vq;
  const vendorLines = (vendors ?? []).map((v) => `- ${v.name} (${v.category}, ${v.city ?? 'area not listed'})${(v.vendor_packages ?? []).map((p) => `; package "${p.title}" ${p.price_cents == null ? 'quote required' : `$${p.price_cents / 100}`}`).join('')}`).join('\n') || '- None listed for this area yet.';

  const priceLines = await priceReferences(supabase, event.location, city);
  const input = `Event details (from the organizer):\n${JSON.stringify(event)}\n\nVerified vendors on Vendora:\n${vendorLines}\n\nPrice references:\n${priceLines}\n\nRequest:\n${prompt}`;

  let res;
  try {
    res = await fetchWithTimeout(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: SYSTEM,
        input,
        max_output_tokens: 2500,
        store: false,
        text: { format: { type: 'json_schema', name: 'event_budget_estimate', strict: true, schema: SCHEMA } },
      }),
    }, 60_000);
  } catch {
    return jsonError('The planner took too long to answer. Try again.', 504);
  }
  if (!res.ok) {
    console.error('OpenAI error', res.status, (await res.text()).slice(0, 500));
    return jsonError('The planner is unavailable right now. Try again.', 502);
  }

  const out = await res.json();
  // Read the text from the output items (output_text is an SDK convenience, not guaranteed in raw JSON).
  const parts = (out.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  if (parts.some((c) => c.type === 'refusal')) return jsonError('The planner could not help with that request. Try describing the event differently.', 422);
  const text = parts.filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  if (out.status === 'incomplete' || !text) return jsonError('The planner’s answer was cut off. Try a shorter request.', 502);

  let plan;
  try { plan = sanitizePlan(JSON.parse(text)); } catch { return jsonError('The planner returned an unreadable answer. Try again.', 502); }

  await supabase.from('ai_requests').insert({ user_id: user.id, kind: 'plan', event_id: eventId, input: { prompt, event }, output: plan });
  return NextResponse.json({ plan, eventId });
}
