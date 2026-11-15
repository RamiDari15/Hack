import { NextResponse } from 'next/server';
import { fetchWithTimeout, jsonError, readJson, requireUserWithinLimit } from '@/lib/api';
import { UUID_RE } from '@/lib/format';

// Drafts the day-of timeline from the event's confirmed and held bookings.
// Server only: OPENAI_API_KEY never reaches the browser. The draft replaces earlier AI items
// only; items the organizer wrote stay. Every item is labeled as an AI draft in the UI.

const SYSTEM = `You draft a day-of run sheet for one event.
- Use only the bookings listed. Never invent vendors, times the vendor has confirmed, or services they did not book.
- Include, for each booked vendor, an arrival or setup slot before guests arrive and a teardown or departure slot when it applies. Use the vendor's setup requirements and policies when given.
- Add the main moments for this type of event (for example ceremony, dinner, speeches, last dance) without vendor ids.
- Times are 24-hour "HH:MM" local time. Use an empty string for end when there is none. Keep it to 6 to 18 items, in time order.
- booking_id is the id from the list, or an empty string. Notes are short and practical, and say "confirm with the vendor" where a time is your suggestion.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['start', 'end', 'title', 'booking_id', 'notes'],
        properties: { start: { type: 'string' }, end: { type: 'string' }, title: { type: 'string' }, booking_id: { type: 'string' }, notes: { type: 'string' } },
      },
    },
  },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
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
  if (!UUID_RE.test(body?.eventId ?? '')) return jsonError('Choose an event.', 400);

  const [{ data: event }, { data: bookings }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, event_type, event_date, location, guest_count, style, notes').eq('id', body.eventId).maybeSingle(),
    supabase.from('event_vendors').select('id, status, vendors(name, category, setup_requirements, booking_policy), quotes(description, status)')
      .eq('event_id', body.eventId).in('status', ['confirmed', 'hold']),
  ]);
  if (!event) return jsonError('Event not found.', 404);
  if (event.owner_id !== user.id) return jsonError('Only the event owner can draft the timeline.', 403);

  const lines = (bookings ?? []).map((b) => {
    const q = (b.quotes ?? []).find((x) => x.status === 'accepted');
    return `- booking ${b.id}: ${b.vendors?.name} (${b.vendors?.category}), ${b.status === 'confirmed' ? 'confirmed' : 'on hold'}.`
      + (b.vendors?.setup_requirements ? ` Setup: ${clean(b.vendors.setup_requirements, 200)}.` : '')
      + (b.vendors?.booking_policy ? ` Policy: ${clean(b.vendors.booking_policy, 160)}.` : '')
      + (q?.description ? ` Accepted quote covers: ${clean(q.description, 200)}.` : '');
  }).join('\n') || '- No confirmed bookings yet.';
  const input = `Event details (from the organizer):\n${JSON.stringify({ title: event.title, type: event.event_type, date: event.event_date, location: event.location, guests: event.guest_count, style: event.style, notes: clean(event.notes, 400) })}\n\nBookings:\n${lines}`;

  let res;
  try {
    res = await fetchWithTimeout(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions: SYSTEM, input, max_output_tokens: 2000, store: false,
        text: { format: { type: 'json_schema', name: 'day_timeline', strict: true, schema: SCHEMA } } }),
    }, 60_000);
  } catch {
    return jsonError('The planner took too long to answer. Try again.', 504);
  }
  if (!res.ok) {
    console.error('OpenAI error', res.status, (await res.text()).slice(0, 500));
    return jsonError('The planner is unavailable right now. Try again.', 502);
  }
  const out = await res.json();
  const text = (out.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  if (out.status === 'incomplete' || !text) return jsonError('The planner’s answer was cut off. Try again.', 502);
  let raw;
  try { raw = JSON.parse(text); } catch { return jsonError('The planner returned an unreadable answer. Try again.', 502); }

  const known = new Set((bookings ?? []).map((b) => b.id));
  const rows = (Array.isArray(raw.items) ? raw.items : []).slice(0, 24)
    .filter((it) => TIME_RE.test(it?.start) && clean(it?.title, 160))
    .map((it) => ({
      event_id: event.id, source: 'ai', start_time: it.start, end_time: TIME_RE.test(it.end) ? it.end : null,
      title: clean(it.title, 160), notes: clean(it.notes, 600) || null, event_vendor_id: known.has(it.booking_id) ? it.booking_id : null,
    }));
  if (!rows.length) return jsonError('The planner did not return a usable timeline. Try again.', 502);

  await supabase.from('event_timeline_items').delete().eq('event_id', event.id).eq('source', 'ai');
  const { error: insErr } = await supabase.from('event_timeline_items').insert(rows);
  if (insErr) return jsonError('Could not save the draft.', 500);
  await supabase.from('ai_requests').insert({ user_id: user.id, kind: 'timeline', event_id: event.id, input: { bookings: known.size }, output: { items: rows.length } });
  return NextResponse.json({ count: rows.length });
}
