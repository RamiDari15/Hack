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
- The "Event details" are the organizer's structured answers and are authoritative: type, date, location, guests, budget, setting, styles, hours and priorities. Use every one of them. If the free-text request conflicts with them, follow the details and mention the conflict in assumptions.
- Budget: when "Plan targets" gives a budget, size the plan to it. Pick the service level that matches the budget per guest, and make the sum of the category midpoints ((low+high)/2) land between 85% and 100% of the budget, with the sum of the high values at or below the budget. Spend extra room on the organizer's priorities and on quality, not on invented extras. If the budget cannot cover a basic event of this size, say so plainly in the summary and assumptions instead of shrinking the event.
- When no budget is given, estimate a typical range for this event and say what service level you assumed.
- Summary: one or two plain sentences, under 35 words, written to the organizer ("you"). Do not repeat the type, date, place, guest count or budget; the page already shows them. Say what the plan puts first and the one thing to watch. No filler words like "signature-level", "amenities" or "realistically".
- Keep lists short and concrete: assumptions at most 3 items under 14 words each (internal, not shown as a list); missing_items at most 6 short noun phrases (under 7 words, no parentheses), only things a planner of this event would genuinely forget, never items already covered by a category row; cost_saving_ideas at most 3 actions under 14 words, each starting with a verb, specific to this event.
- Recommendations: always fill "recommendations" with businesses for the main categories of this event (aim for 1 to 2 per category, up to 12). Pick them only from "Verified vendors on Vendora" and "Businesses listed on Vendora"; prefer verified ones, then ones whose published prices fit the budget. Copy each business name exactly. Give a concrete reason tied to this event (capacity, style, location, published price). Never name any other business, and never claim availability, ratings or verification you were not given. If a category has no listed business, leave it out of recommendations and give practical advice for it in the category notes instead.
- Never say you cannot recommend vendors. Give confident, practical guidance from general event-planning knowledge in notes, missing items and savings ideas.
- If the event details include "rsvps", treat coming as the firm headcount and coming plus maybe plus no_reply_yet as the upper bound; size per-person costs and catering from those numbers and mention meal counts in the catering notes.
- Calibrate every range with "Price references". Published prices are what local businesses list publicly and may be out of date; budget-guide ranges are Vendora's typical planning ranges. Scale per-person and per-hour figures by the guest count and event length.
- When a published price shaped a row, you may name that business in the row's notes as "published rate from <name>". Never call a reference a quote, and never say a business is available or verified.
- State every assumption you make (season, region, service style).
- Checklist: 6 to 12 steps ordered by when they should happen. Each task is a short imperative under 8 words ("Book the venue"). weeks_before is how many weeks before the event the step should be done (0 for the day itself); when is the same in words ("10 months before").`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'assumptions', 'categories', 'recommendations', 'missing_items', 'cost_saving_ideas', 'checklist'],
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
    recommendations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['category', 'vendor_name', 'why'],
        properties: { category: { type: 'string' }, vendor_name: { type: 'string' }, why: { type: 'string' } },
      },
    },
    missing_items: { type: 'array', items: { type: 'string' } },
    cost_saving_ideas: { type: 'array', items: { type: 'string' } },
    checklist: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['task', 'when', 'weeks_before'], properties: { task: { type: 'string' }, when: { type: 'string' }, weeks_before: { type: 'integer' } } },
    },
  },
};

const dollars = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sanitizePlan(p, known = new Map()) {
  const num = (n) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
  const list = (a, max = 12) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, max).map((x) => x.slice(0, 300)) : []);
  return {
    summary: clean(p.summary, 800),
    assumptions: list(p.assumptions),
    categories: (Array.isArray(p.categories) ? p.categories : []).slice(0, 20).map((c) => {
      const low = num(c.low), high = num(c.high);
      return { name: clean(c.name, 80) || 'Other', low: Math.min(low, high), high: Math.max(low, high), notes: clean(c.notes, 200) };
    }),
    // Only businesses we actually sent the model survive; each carries its id and verification.
    recommendations: (Array.isArray(p.recommendations) ? p.recommendations : []).map((r) => {
      const v = known.get(clean(r?.vendor_name, 160).toLowerCase());
      return v ? { category: v.category, vendor_id: v.id, vendor_name: v.name, verified: v.verification_status === 'verified', city: v.city ?? '', why: clean(r.why, 240) } : null;
    }).filter(Boolean).filter((r, i, a) => a.findIndex((x) => x.vendor_id === r.vendor_id) === i).slice(0, 12),
    missing_items: list(p.missing_items),
    cost_saving_ideas: list(p.cost_saving_ideas),
    checklist: (Array.isArray(p.checklist) ? p.checklist : []).slice(0, 20).map((c) => ({ task: clean(c.task, 160), when: clean(c.when, 80), weeks_before: Number.isInteger(c.weeks_before) && c.weeks_before >= 0 && c.weeks_before <= 156 ? c.weeks_before : null })),
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
  // The request text is optional: the structured details are enough for a full estimate.
  const request_ = prompt || 'Build a complete budget estimate for this event from the details above.';

  // Event details: from the user's saved event when given (RLS checks ownership), else from the form.
  let eventId = null;
  let event = {
    type: EVENT_TYPES.includes(body?.event?.type) ? body.event.type : 'Other',
    date: clean(body?.event?.date, 10), location: clean(body?.event?.location, 160),
    guests: clean(String(body?.event?.guests ?? ''), 7), budget: clean(String(body?.event?.budget ?? ''), 12), style: clean(body?.event?.style, 160),
  };
  const extra = {
    setting: ['indoor', 'outdoor', 'both'].includes(body?.event?.setting) ? body.event.setting : '',
    hours: Number.isInteger(Number(body?.event?.hours)) && Number(body.event.hours) >= 1 && Number(body.event.hours) <= 24 ? Number(body.event.hours) : null,
    priorities: Array.isArray(body?.event?.priorities) ? body.event.priorities.filter((x) => typeof x === 'string').slice(0, 5).map((x) => x.slice(0, 40)) : [],
  };
  if (body?.eventId && UUID_RE.test(body.eventId)) {
    const { data } = await supabase.from('events').select('id, event_type, event_date, location, guest_count, budget_cents, style, guest_list_enabled, meal_options').eq('id', body.eventId).maybeSingle();
    if (data) {
      eventId = data.id;
      event = { type: data.event_type, date: data.event_date ?? '', location: data.location ?? '', guests: String(data.guest_count ?? ''), budget: data.budget_cents == null ? '' : String(data.budget_cents / 100), style: data.style ?? '' };
      // Optional guest list: real RSVP numbers and meal counts, when the organizer uses it.
      if (data.guest_list_enabled) {
        const { data: guests } = await supabase.from('event_guests').select('status, party_size, attending, meal, dietary').eq('event_id', data.id);
        if (guests?.length) {
          const sum = (st, f) => guests.filter((g) => g.status === st).reduce((n, g) => n + (f(g) ?? 0), 0);
          const meals = {};
          for (const g of guests) if (g.status === 'yes' && g.meal) meals[g.meal] = (meals[g.meal] ?? 0) + (g.attending ?? 0);
          event.rsvps = {
            coming: sum('yes', (g) => g.attending), maybe: sum('maybe', (g) => g.attending),
            no_reply_yet: sum('invited', (g) => g.party_size), declined_parties: guests.filter((g) => g.status === 'no').length,
            meals, dietary_needs: guests.filter((g) => g.status !== 'no' && g.dietary).length,
          };
        }
      }
    }
  }

  // Grounding: a short list of verified vendors, filtered by city when one is given.
  let vq = supabase.from('vendors').select('name, category, city, vendor_packages(title, price_cents)').eq('verification_status', 'verified').limit(15);
  const city = event.location.split(',')[0].replace(/[%_,()]/g, '').trim();
  if (city) vq = vq.ilike('city', `%${city}%`);
  const { data: vendors } = await vq;
  const vendorLines = (vendors ?? []).map((v) => `- ${v.name} (${v.category}, ${v.city ?? 'area not listed'})${(v.vendor_packages ?? []).map((p) => `; package "${p.title}" ${p.price_cents == null ? 'quote required' : `$${p.price_cents / 100}`}`).join('')}`).join('\n') || '- None listed for this area yet.';

  // Real businesses from Vendora's public directory near the event (sourced listings, not verified),
  // up to 4 per category, so the planner can recommend names that exist.
  let lq = supabase.from('vendors').select('id, name, category, city, description, service_radius_mi, vendor_packages(title, price_cents)').eq('directory_listed', true).limit(160);
  if (city) lq = lq.ilike('city', `%${city}%`);
  const { data: listed } = await lq;
  const perCat = {};
  for (const v of listed ?? []) { (perCat[v.category] ??= []).length < 4 && perCat[v.category].push(v); }
  const listings = Object.values(perCat).flat();
  const listingLines = listings.map((v) => `- ${v.name} (${v.category}, ${v.city ?? 'area not listed'})${(v.vendor_packages ?? []).filter((p) => p.price_cents != null).slice(0, 1).map((p) => `; published "${p.title}" $${p.price_cents / 100}`).join('')}${v.description ? `; ${v.description.slice(0, 90)}` : ''}`).join('\n') || '- None listed for this area yet.';
  const { data: verifiedFull } = await supabase.from('vendors').select('id, name, category, city, verification_status').in('name', (vendors ?? []).map((v) => v.name).slice(0, 15));
  const known = new Map([...(verifiedFull ?? []), ...listings.map((v) => ({ ...v, verification_status: 'unverified' }))].map((v) => [v.name.toLowerCase(), v]));

  const priceLines = await priceReferences(supabase, event.location, city);
  Object.assign(event, Object.fromEntries(Object.entries(extra).filter(([, v]) => (Array.isArray(v) ? v.length : v))));
  const budget = Number(String(event.budget).replace(/[$,\s]/g, ''));
  const guests = Number(event.guests);
  const hasBudget = Number.isFinite(budget) && budget > 0;
  const targets = hasBudget
    ? `Budget ${dollars(budget)}${guests > 0 ? `, about ${dollars(Math.round(budget / guests))} per guest for ${guests} guests` : ''}. Category midpoints should add up to ${dollars(Math.round(budget * 0.85))}-${dollars(budget)}.`
    : 'No budget given.';
  const input = `Event details (from the organizer):\n${JSON.stringify(event)}\n\nPlan targets:\n${targets}\n\nVerified vendors on Vendora:\n${vendorLines}\n\nBusinesses listed on Vendora (public listings, not verified):\n${listingLines}\n\nPrice references:\n${priceLines}\n\nRequest:\n${request_}`;

  let res;
  try {
    res = await fetchWithTimeout(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: SYSTEM,
        input,
        max_output_tokens: 3500,
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
  try { plan = sanitizePlan(JSON.parse(text), known); } catch { return jsonError('The planner returned an unreadable answer. Try again.', 502); }

  // How the estimate sits against the organizer's budget, computed here rather than trusted from the model.
  if (hasBudget) {
    const low = plan.categories.reduce((n, c) => n + c.low, 0), high = plan.categories.reduce((n, c) => n + c.high, 0);
    plan.budget_fit = { budget, low, high, mid_share: Math.round(((low + high) / 2 / budget) * 100) };
  }
  // The details the plan was built for, shown as chips above the result.
  plan.facts = {
    type: event.type || null, date: event.date || null, location: event.location || null,
    guests: guests > 0 ? guests : null, budget: hasBudget ? budget : null,
    per_guest: hasBudget && guests > 0 ? Math.round(budget / guests) : null,
    setting: event.setting || null, hours: Number(event.hours) || null,
  };
  const { data: saved } = await supabase.from('ai_requests').insert({ user_id: user.id, kind: 'plan', event_id: eventId, input: { prompt: request_, event }, output: plan }).select('id').single();
  return NextResponse.json({ plan, eventId, planId: saved?.id ?? null });
}
