'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import { fetchNasaHistory } from '@/lib/weather';

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

// ---------------------------------------------------------------------------
// Weather history (NASA POWER), on request. Uses the event's saved coordinates, or the average
// position of Vendora listings in the event's city, and caches the summary for the event.
// ---------------------------------------------------------------------------
export async function checkWeather(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const { data: event } = await s.supabase.from('events').select('id, owner_id, event_date, location, latitude, longitude').eq('id', s.eid).maybeSingle();
  if (!event || event.owner_id !== s.user.id) return { error: 'Only the event owner can check the weather history.' };
  if (!event.event_date) return { error: 'Add an event date first.' };
  let lat = event.latitude; let lng = event.longitude; let place = 'saved event coordinates';
  if (lat == null || lng == null) {
    const city = (event.location ?? '').split(',')[0].trim();
    if (!city) return { error: 'Add the event location first.' };
    const { data: c } = await s.supabase.rpc('city_coordinates', { city_name: city });
    if (!c?.[0]) return { error: `Vendora has no listings in ${city} to place it on the map yet.` };
    lat = c[0].latitude; lng = c[0].longitude;
    place = `center of ${c[0].listings} Vendora listings in ${city}`;
  }
  let summary;
  try {
    summary = await fetchNasaHistory({ latitude: lat, longitude: lng, eventDate: event.event_date });
  } catch (e) {
    console.error('NASA POWER', e?.message);
    return { error: 'NASA POWER did not answer. Try again in a minute.' };
  }
  const { error } = await s.supabase.from('event_weather').upsert({
    event_id: event.id, event_date: event.event_date, latitude: lat, longitude: lng, place_note: place, summary, fetched_at: new Date().toISOString(),
  });
  if (error) return { error: 'Could not save the weather history.' };
  refresh(s.eid);
  return { ok: true, message: 'Weather history updated from NASA POWER.' };
}

// ---------------------------------------------------------------------------
// Event website (public page, off until published)
// ---------------------------------------------------------------------------
const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';

export async function setWebsite(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const { data: event } = await s.supabase.from('events').select('id, owner_id, title, website_slug').eq('id', s.eid).maybeSingle();
  if (!event || event.owner_id !== s.user.id) return { error: 'Only the event owner can publish the website.' };
  const patch = {};
  if (fd.has('enabled')) patch.website_enabled = fd.get('enabled') === 'yes';
  if (fd.has('intro')) patch.website_intro = str(fd.get('intro'), 2000) || null;
  if (patch.website_enabled && !event.website_slug) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, '0')).join('');
    patch.website_slug = `${slugify(event.title)}-${rand}`;
  }
  const { error } = await s.supabase.from('events').update(patch).eq('id', s.eid);
  if (error) return { error: 'Could not save the website.' };
  refresh(s.eid, 'website');
  return { ok: true, message: patch.website_enabled === false ? 'Website is offline.' : patch.website_enabled ? 'Website is live.' : 'Saved.' };
}

export async function toggleScheduleItem(fd) {
  const s = await session(fd);
  const tid = id(fd);
  if (s.error || !tid) return;
  await s.supabase.from('event_timeline_items').update({ show_on_website: fd.get('show') === 'yes' }).eq('id', tid);
  refresh(s.eid, 'website', 'timeline');
}

// ---------------------------------------------------------------------------
// Seating chart
// ---------------------------------------------------------------------------
const seatsFor = (g) => (g.status === 'no' ? 0 : g.status === 'invited' ? g.party_size : (g.attending ?? 0));

export async function addTables(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const count = Number(str(fd.get('count'), 3) || 1);
  const seats = Number(str(fd.get('seats'), 3) || 8);
  if (!Number.isInteger(count) || count < 1 || count > 40) return { error: 'Add 1 to 40 tables at a time.' };
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) return { error: 'Seats per table must be 1 to 40.' };
  const { count: have } = await s.supabase.from('event_tables').select('id', { count: 'exact', head: true }).eq('event_id', s.eid);
  const prefix = str(fd.get('name'), 40) || 'Table';
  const rows = Array.from({ length: count }, (_, i) => ({ event_id: s.eid, name: count === 1 && fd.get('name') ? prefix : `${prefix} ${(have ?? 0) + i + 1}`, seats }));
  const { error } = await s.supabase.from('event_tables').insert(rows);
  if (error) return { error: 'Only the event owner can edit the seating chart.' };
  refresh(s.eid, 'seating');
  return { ok: true, message: `Added ${count} ${count === 1 ? 'table' : 'tables'}.` };
}

export async function removeTable(fd) {
  const s = await session(fd);
  const tid = id(fd);
  if (s.error || !tid) return;
  await s.supabase.from('event_tables').delete().eq('id', tid);
  refresh(s.eid, 'seating');
}

export async function seatGuest(fd) {
  const s = await session(fd);
  const gid = id(fd, 'guest_id');
  if (s.error || !gid) return;
  await s.supabase.from('event_guests').update({ table_id: id(fd, 'table_id') }).eq('id', gid);
  refresh(s.eid, 'seating');
}

// Seats unseated parties largest first into the table with the most room that fits them.
export async function autoSeat(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const [{ data: tables }, { data: guests }] = await Promise.all([
    s.supabase.from('event_tables').select('id, seats').eq('event_id', s.eid),
    s.supabase.from('event_guests').select('id, status, party_size, attending, table_id').eq('event_id', s.eid),
  ]);
  if (!tables?.length) return { error: 'Add tables first.' };
  const free = Object.fromEntries(tables.map((t) => [t.id, t.seats]));
  for (const g of guests ?? []) if (g.table_id && free[g.table_id] != null) free[g.table_id] -= seatsFor(g);
  const waiting = (guests ?? []).filter((g) => !g.table_id && seatsFor(g) > 0).sort((a, b) => seatsFor(b) - seatsFor(a));
  let placed = 0; let left = 0;
  for (const g of waiting) {
    const need = seatsFor(g);
    const best = Object.entries(free).filter(([, n]) => n >= need).sort((a, b) => b[1] - a[1])[0];
    if (!best) { left += 1; continue; }
    const { error } = await s.supabase.from('event_guests').update({ table_id: best[0] }).eq('id', g.id);
    if (error) return { error: 'Only the event owner can edit the seating chart.' };
    free[best[0]] -= need; placed += 1;
  }
  refresh(s.eid, 'seating');
  return { ok: true, message: left ? `Seated ${placed} parties. ${left} did not fit; add tables or seats.` : `Seated ${placed} parties.` };
}
