'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { drainEmailOutbox } from '@/lib/email';
import { getSessionUser } from '@/lib/supabase/server';
import { EVENT_TYPES } from '@/lib/categories';
import { UUID_RE } from '@/lib/format';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function parseEvent(formData) {
  const errors = {};
  const title = str(formData.get('title'), 140);
  const eventType = str(formData.get('event_type'), 40);
  const eventDate = str(formData.get('event_date'), 10);
  const location = str(formData.get('location'), 160);
  const style = str(formData.get('style'), 160);
  const notes = str(formData.get('notes'), 4000);
  const guestsRaw = str(formData.get('guest_count'), 7);
  const budgetRaw = str(formData.get('budget'), 12).replace(/[$,\s]/g, '');

  if (!title) errors.title = 'Give the event a name.';
  if (!EVENT_TYPES.includes(eventType)) errors.event_type = 'Choose an event type.';
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errors.event_date = 'Use a valid date.';
  const guests = guestsRaw ? Number(guestsRaw) : null;
  if (guestsRaw && (!Number.isInteger(guests) || guests < 1 || guests > 100000)) errors.guest_count = 'Enter a whole number of guests.';
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (budgetRaw && (!Number.isFinite(budget) || budget < 0)) errors.budget = 'Enter a budget in dollars.';

  return {
    errors,
    values: { title, eventType, eventDate, location, style, notes, guests: guestsRaw, budget: budgetRaw },
    row: {
      title, event_type: eventType, event_date: eventDate || null, location: location || null, style: style || null,
      notes: notes || null, guest_count: guests, budget_cents: budget == null ? null : Math.round(budget * 100),
    },
  };
}

export async function createEvent(_prev, formData) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: 'The database is not connected yet.', values: {} };
  if (!user) redirect('/sign-in?next=/events/new');

  const { errors, values, row } = parseEvent(formData);
  if (Object.keys(errors).length) return { errors, values };

  const { data, error } = await supabase.from('events').insert({ ...row, owner_id: user.id }).select('id').single();
  if (error) return { error: 'Could not save the event. Try again.', values };
  revalidatePath('/dashboard');
  redirect(`/events/${data.id}?created=1`);
}

export async function updateEvent(_prev, formData) {
  const id = str(formData.get('id'), 36);
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user || !UUID_RE.test(id)) return { error: 'Sign in again to save changes.' };
  const { errors, values, row } = parseEvent(formData);
  if (Object.keys(errors).length) return { errors, values };
  // RLS limits this to the owner's own row.
  const { error } = await supabase.from('events').update(row).eq('id', id);
  if (error) return { error: 'Could not save changes. Try again.', values };
  revalidatePath(`/events/${id}`);
  revalidatePath('/dashboard');
  return { ok: true, values };
}

export async function deleteEvent(formData) {
  const id = str(formData.get('id'), 36);
  const confirmed = formData.get('confirm') === 'yes';
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user || !UUID_RE.test(id) || !confirmed) redirect(`/events/${id}?error=confirm`);
  await supabase.from('events').delete().eq('id', id);
  revalidatePath('/dashboard');
  redirect('/dashboard?deleted=1');
}

// Creates an inquiry to a verified vendor for one of the user's events.
// The form requires an explicit confirmation checkbox; nothing is booked or paid.
export async function requestQuote(_prev, formData) {
  const eventId = str(formData.get('event_id'), 36);
  const vendorId = str(formData.get('vendor_id'), 36);
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { error: 'Sign in to request a quote.' };
  if (formData.get('confirm') !== 'yes') return { error: 'Confirm that you want to send this inquiry.' };
  if (!UUID_RE.test(eventId) || !UUID_RE.test(vendorId)) return { error: 'Choose one of your events.' };

  const { error } = await supabase.from('event_vendors').insert({ event_id: eventId, vendor_id: vendorId, status: 'inquiry' });
  if (error?.code === '23505') return { ok: true, message: 'You already sent this vendor an inquiry for that event.' };
  if (error) return { error: 'Could not send the inquiry. The vendor may not be verified yet.' };
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/choose`);
  after(() => drainEmailOutbox().catch(() => {}));
  return { ok: true, message: 'Inquiry sent. The vendor’s reply will appear on your event page.' };
}

// Saves one external web result to the user's event. External results stay labeled as
// unverified; this never creates a vendor or a booking.
export async function saveExternalResult(_prev, formData) {
  const eventId = str(formData.get('event_id'), 36);
  const url = str(formData.get('url'), 2000);
  const title = str(formData.get('title'), 200);
  const snippet = str(formData.get('snippet'), 600);
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { error: 'Sign in to save results.' };
  if (!UUID_RE.test(eventId)) return { error: 'Choose one of your events.' };
  let host;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    host = u.hostname.replace(/^www\./, '');
  } catch {
    return { error: 'That result has an invalid link.' };
  }
  const { error } = await supabase.from('event_saved_results')
    .insert({ event_id: eventId, url, title: title || host, host, snippet: snippet || null });
  if (error?.code === '23505') return { ok: true, message: 'Already saved to that event.' };
  if (error) return { error: 'Could not save this result.' };
  revalidatePath(`/events/${eventId}`);
  return { ok: true, message: 'Saved to your event, marked as external.' };
}

export async function removeExternalResult(formData) {
  const id = str(formData.get('id'), 36);
  const eventId = str(formData.get('event_id'), 36);
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user || !UUID_RE.test(id) || !UUID_RE.test(eventId)) return;
  await supabase.from('event_saved_results').delete().eq('id', id);
  revalidatePath(`/events/${eventId}`);
}
