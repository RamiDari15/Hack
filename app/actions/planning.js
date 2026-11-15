'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Guest list (optional per event) and the day-of timeline. Row-level security limits every
// write to the event's owner; these actions only validate input and give readable errors.

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (fd, key = 'id') => { const v = str(fd.get(key), 36); return UUID_RE.test(v) ? v : null; };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function session(fd) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: 'The database is not connected yet.' };
  if (!user) return { error: 'Sign in again to continue.' };
  const eid = id(fd, 'event_id');
  if (!eid) return { error: 'Event not found.' };
  return { supabase, user, eid };
}

const refresh = (eid, page) => { revalidatePath(`/events/${eid}`); if (page) revalidatePath(`/events/${eid}/${page}`); };

// ---------------------------------------------------------------------------
// Guest list
// ---------------------------------------------------------------------------
export async function setGuestList(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const enabled = fd.get('enabled') === 'yes';
  const meals = str(fd.get('meal_options'), 600).split(/[\n,]/).map((m) => m.trim().slice(0, 80)).filter(Boolean);
  if (meals.length > 8) return { error: 'Use up to 8 meal options.' };
  const patch = { guest_list_enabled: enabled };
  if (fd.has('meal_options')) patch.meal_options = [...new Set(meals)];
  const { error } = await s.supabase.from('events').update(patch).eq('id', s.eid);
  if (error) return { error: 'Only the event owner can change the guest list.' };
  refresh(s.eid, 'guests');
  return { ok: true, message: enabled ? 'Guest list is on.' : 'Guest list is off. RSVP links stop working until you turn it back on.' };
}

// One guest per line: "Name", "Name, email" or "Name, email, party size".
export async function addGuests(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const lines = str(fd.get('guests'), 20000).split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { error: 'Add at least one guest, one per line.' };
  if (lines.length > 300) return { error: 'Add up to 300 guests at a time.' };
  const rows = [];
  for (const [i, line] of lines.entries()) {
    const [name, email = '', size = ''] = line.split(/\s*[,;\t]\s*/);
    const party = size ? Number(size) : 1;
    if (!name || name.length > 120) return { error: `Line ${i + 1}: add a name under 120 characters.` };
    if (email && !EMAIL_RE.test(email)) return { error: `Line ${i + 1}: "${email}" does not look like an email.` };
    if (!Number.isInteger(party) || party < 1 || party > 20) return { error: `Line ${i + 1}: party size must be 1 to 20.` };
    rows.push({ event_id: s.eid, name, email: email || null, party_size: party });
  }
  const { error } = await s.supabase.from('event_guests').insert(rows);
  if (error) return { error: 'Only the event owner can add guests.' };
  refresh(s.eid, 'guests');
  return { ok: true, message: `Added ${rows.length} ${rows.length === 1 ? 'guest' : 'guests'}.` };
}

export async function removeGuest(fd) {
  const s = await session(fd);
  const gid = id(fd);
  if (s.error || !gid) return;
  await s.supabase.from('event_guests').delete().eq('id', gid);
  refresh(s.eid, 'guests');
}

// Sets the event's guest count to the expected headcount from RSVPs, so estimates and
// per-person prices use it.
export async function applyRsvpHeadcount(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const { data: guests, error } = await s.supabase.from('event_guests').select('status, party_size, attending').eq('event_id', s.eid);
  if (error) return { error: 'Could not read the guest list.' };
  const expected = (guests ?? []).reduce((n, g) => n + (g.status === 'no' ? 0 : g.status === 'invited' ? g.party_size : (g.attending ?? 0)), 0);
  if (!expected) return { error: 'No guests are expected yet.' };
  const { error: e2 } = await s.supabase.from('events').update({ guest_count: expected }).eq('id', s.eid);
  if (e2) return { error: 'Only the event owner can change the guest count.' };
  refresh(s.eid, 'guests');
  return { ok: true, message: `Event guest count set to ${expected}. Rebuild the estimate to update the budget.` };
}

// ---------------------------------------------------------------------------
// Day-of timeline
// ---------------------------------------------------------------------------
export async function addTimelineItem(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const start = str(fd.get('start_time'), 5);
  const end = str(fd.get('end_time'), 5);
  const title = str(fd.get('title'), 160);
  if (!TIME_RE.test(start)) return { error: 'Choose a start time.' };
  if (end && !TIME_RE.test(end)) return { error: 'That end time is not valid.' };
  if (!title) return { error: 'Describe what happens.' };
  const booking = id(fd, 'event_vendor_id');
  const { error } = await s.supabase.from('event_timeline_items').insert({
    event_id: s.eid, start_time: start, end_time: end || null, title, notes: str(fd.get('notes'), 600) || null, event_vendor_id: booking, source: 'organizer',
  });
  if (error) return { error: 'Only the event owner can edit the timeline.' };
  refresh(s.eid, 'timeline');
  return { ok: true, message: 'Added to the timeline.' };
}

export async function removeTimelineItem(fd) {
  const s = await session(fd);
  const tid = id(fd);
  if (s.error || !tid) return;
  await s.supabase.from('event_timeline_items').delete().eq('id', tid);
  refresh(s.eid, 'timeline');
}

export async function clearAiTimeline(fd) {
  const s = await session(fd);
  if (s.error) return;
  await s.supabase.from('event_timeline_items').delete().eq('event_id', s.eid).eq('source', 'ai');
  refresh(s.eid, 'timeline');
}

// ---------------------------------------------------------------------------
// Registry (optional). Links and notes only; nothing is bought through Vendora.
// ---------------------------------------------------------------------------
export async function setRegistry(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const enabled = fd.get('enabled') === 'yes';
  const { error } = await s.supabase.from('events').update({ registry_enabled: enabled }).eq('id', s.eid);
  if (error) return { error: 'Only the event owner can change the registry.' };
  refresh(s.eid, 'registry');
  return { ok: true, message: enabled ? 'Registry is on.' : 'Registry is off. Guests no longer see it.' };
}

export async function addRegistryItem(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const title = str(fd.get('title'), 160);
  const url = str(fd.get('url'), 2000);
  const qty = Number(str(fd.get('quantity'), 3) || 1);
  if (!title) return { error: 'Name the gift.' };
  if (url && !/^https?:\/\//.test(url)) return { error: 'Links must start with http:// or https://.' };
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) return { error: 'Quantity must be 1 to 50.' };
  const { error } = await s.supabase.from('event_registry_items').insert({
    event_id: s.eid, title, url: url || null, quantity: qty, price_note: str(fd.get('price_note'), 40) || null, note: str(fd.get('note'), 300) || null,
  });
  if (error) return { error: 'Only the event owner can add gifts.' };
  refresh(s.eid, 'registry');
  return { ok: true, message: 'Added to the registry.' };
}

export async function removeRegistryItem(fd) {
  const s = await session(fd);
  const rid = id(fd);
  if (s.error || !rid) return;
  await s.supabase.from('event_registry_items').delete().eq('id', rid);
  refresh(s.eid, 'registry');
}
