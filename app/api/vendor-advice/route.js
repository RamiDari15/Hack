import { NextResponse } from 'next/server';
import { fetchWithTimeout, jsonError, readJson, requireUserWithinLimit } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { UUID_RE } from '@/lib/format';
import { walkthroughSteps, loadCandidates, rankVendors } from '@/lib/vendor-match';

// "Help me choose" in the vendor walkthrough. Server only: OPENAI_API_KEY never reaches the browser.
// The model sees only vendors Vendora holds for this event's category, with the same facts the page
// shows, and must answer with their ids. Any id it invents is dropped.

const SYSTEM = `You help an event organizer choose one vendor in a single category.
- Use only the vendors and facts listed. Never invent prices, availability, reviews, ratings or verification.
- Prefer verified vendors, a published price inside the estimate, and no calendar conflict. Say plainly when a price or availability is unknown.
- "pick" is the id of the vendor you suggest, or an empty string if none fits.
- For each vendor you mention, give one short sentence on fit, citing the listed facts.
- "questions" are short, practical questions the organizer should ask vendors before deciding (3 to 5).
- Keep the summary under 60 words. Plain language, no hype.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'pick', 'vendors', 'questions'],
  properties: {
    summary: { type: 'string' },
    pick: { type: 'string' },
    vendors: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'fit'], properties: { id: { type: 'string' }, fit: { type: 'string' } } } },
    questions: { type: 'array', items: { type: 'string' } },
  },
};

const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return jsonError('The AI planner is not configured yet. Add OPENAI_API_KEY and OPENAI_MODEL.', 503);

  const gate = await requireUserWithinLimit();
  if (gate.error) return gate.error;
  const { supabase, user } = gate;

  const { body, error } = await readJson(request);
  if (error) return jsonError(error, 400);
  if (!UUID_RE.test(body?.eventId ?? '') || !CATEGORIES.includes(body?.category)) return jsonError('Choose an event and a category.', 400);

  // RLS: only people who can view the event get it.
  const [{ data: event }, { data: plans }] = await Promise.all([
    supabase.from('events').select('id, title, event_type, event_date, location, guest_count, budget_cents, style').eq('id', body.eventId).maybeSingle(),
    supabase.from('ai_requests').select('output').eq('event_id', body.eventId).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
  ]);
  if (!event) return jsonError('Event not found.', 404);
  const step = walkthroughSteps(event, plans?.[0]?.output).find((s) => s.category === body.category)
    ?? { category: body.category, lowCents: null, highCents: null, notes: '' };
  const { vendors, calendars } = await loadCandidates(supabase, event, step.category);
  const ranked = rankVendors({ vendors, calendars, event, step }).slice(0, 8);
  if (!ranked.length) return jsonError('There are no vendors to compare in this category yet.', 404);

  const facts = ranked.map((v) => `- id ${v.id}: ${v.name}${v.city ? ` (${v.city})` : ''}. ${v.reasons.map((r) => r.text).join('. ')}.${v.description ? ` About: ${clean(v.description, 240)}` : ''}`).join('\n');
  const estimate = step.highCents != null ? `$${step.lowCents / 100}–$${step.highCents / 100}` : 'no estimate yet';
  const input = `Event details (from the organizer):\n${JSON.stringify({ type: event.event_type, date: event.event_date, location: event.location, guests: event.guest_count, style: event.style })}\n\nCategory: ${step.category}. Estimate for this category: ${estimate}.\n\nVendors for this category:\n${facts}`;

  let res;
  try {
    res = await fetchWithTimeout(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, instructions: SYSTEM, input, max_output_tokens: 1200, store: false,
        text: { format: { type: 'json_schema', name: 'vendor_advice', strict: true, schema: SCHEMA } },
      }),
    }, 45_000);
  } catch {
    return jsonError('The planner took too long to answer. Try again.', 504);
  }
  if (!res.ok) {
    console.error('OpenAI error', res.status, (await res.text()).slice(0, 500));
    return jsonError('The planner is unavailable right now. Try again.', 502);
  }
  const out = await res.json();
  const parts = (out.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  const text = parts.filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  if (out.status === 'incomplete' || !text) return jsonError('The planner’s answer was cut off. Try again.', 502);

  let raw;
  try { raw = JSON.parse(text); } catch { return jsonError('The planner returned an unreadable answer. Try again.', 502); }
  const known = new Set(ranked.map((v) => v.id));
  const advice = {
    summary: clean(raw.summary, 600),
    pick: known.has(raw.pick) ? raw.pick : '',
    vendors: (Array.isArray(raw.vendors) ? raw.vendors : []).filter((v) => known.has(v?.id)).slice(0, 8).map((v) => ({ id: v.id, fit: clean(v.fit, 300) })),
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map((q) => clean(q, 200)).filter(Boolean).slice(0, 5),
  };

  await supabase.from('ai_requests').insert({ user_id: user.id, kind: 'advice', event_id: null, input: { eventId: event.id, category: step.category }, output: advice });
  return NextResponse.json({ advice });
}
