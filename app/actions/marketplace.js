'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/categories';
import { UUID_RE } from '@/lib/format';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (fd, key = 'id') => { const v = str(fd.get(key), 36); return UUID_RE.test(v) ? v : null; };
const dollarsToCents = (raw) => {
  const s = String(raw ?? '').replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
// Postgres raises readable messages from our functions; show those, hide anything else.
const dbMessage = (error, fallback) => {
  const m = error?.message ?? '';
  return /^[A-Z][^\n]{3,140}[.!]$/.test(m) && !/violates|permission|relation|syntax/i.test(m) ? m : fallback;
};

async function session() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: 'The database is not connected yet.' };
  if (!user) return { error: 'Sign in again to continue.' };
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------
function parseVendor(fd) {
  const errors = {};
  const v = {
    name: str(fd.get('name'), 120), category: str(fd.get('category'), 60), city: str(fd.get('city'), 120),
    radius: str(fd.get('service_radius_mi'), 5), description: str(fd.get('description'), 4000),
    setup: str(fd.get('setup_requirements'), 2000), policy: str(fd.get('booking_policy'), 2000),
    legal: str(fd.get('legal_name'), 160), businessId: str(fd.get('business_id'), 80), website: str(fd.get('website'), 300),
    email: str(fd.get('contact_email'), 200), phone: str(fd.get('phone'), 40),
  };
  if (v.name.length < 2) errors.name = 'Enter your business name.';
  if (!CATEGORIES.includes(v.category)) errors.category = 'Choose a category.';
  if (!v.city) errors.city = 'Enter the city you work from.';
  const radius = v.radius ? Number(v.radius) : null;
  if (v.radius && (!Number.isInteger(radius) || radius < 0 || radius > 1000)) errors.service_radius_mi = 'Enter miles from 0 to 1000.';
  if (!v.legal) errors.legal_name = 'Enter the legal business name for review.';
  if (v.website && !/^https?:\/\/\S+\.\S+/.test(v.website)) errors.website = 'Start the link with https://';
  if (!/^\S+@\S+\.\S+$/.test(v.email)) errors.contact_email = 'Enter an email for booking requests.';
  return {
    errors, values: v,
    row: {
      name: v.name, category: v.category, city: v.city, service_radius_mi: radius, description: v.description || null,
      setup_requirements: v.setup || null, booking_policy: v.policy || null, legal_name: v.legal, business_id: v.businessId || null,
      website: v.website || null, contact_email: v.email, phone: v.phone || null,
    },
  };
}

export async function applyAsVendor(_prev, fd) {
  const s = await session();
  if (s.error) return { error: s.error };
  const { errors, values, row } = parseVendor(fd);
  if (fd.get('confirm') !== 'yes') errors.confirm = 'Confirm the details are accurate.';
  if (Object.keys(errors).length) return { errors, values };
  const { data, error } = await s.supabase.from('vendors').insert({ ...row, owner_id: s.user.id }).select('id').single();
  if (error) return { error: 'Could not submit your application. Try again.', values };
  await s.supabase.rpc('add_my_role', { r: 'vendor' });
  revalidatePath('/vendor');
  redirect(`/vendor/profile/${data.id}?submitted=1`);
}

export async function updateVendor(_prev, fd) {
  const s = await session();
  const vid = id(fd);
  if (s.error || !vid) return { error: s.error ?? 'Vendor not found.' };
  const { errors, values, row } = parseVendor(fd);
  if (Object.keys(errors).length) return { errors, values };
  const { error } = await s.supabase.from('vendors').update(row).eq('id', vid);
  if (error) return { error: 'Could not save changes.', values };
  revalidatePath(`/vendor/profile/${vid}`);
  revalidatePath(`/vendors/${vid}`);
  return { ok: true, values, message: 'Saved.' };
}

export async function addPackage(_prev, fd) {
  const s = await session();
  const vid = id(fd, 'vendor_id');
  if (s.error || !vid) return { error: s.error ?? 'Vendor not found.' };
  const title = str(fd.get('title'), 120);
  const cents = dollarsToCents(fd.get('price'));
  if (!title) return { error: 'Name the package.' };
  if (Number.isNaN(cents)) return { error: 'Enter a price in dollars, or leave it empty to quote per event.' };
  const { error } = await s.supabase.from('vendor_packages').insert({ vendor_id: vid, title, price_cents: cents, description: str(fd.get('description'), 500) || null });
  if (error) return { error: 'Could not add the package.' };
  revalidatePath(`/vendor/profile/${vid}`);
  return { ok: true, message: `Added ${title}.` };
}

export async function removePackage(fd) {
  const s = await session();
  const pid = id(fd); const vid = id(fd, 'vendor_id');
  if (s.error || !pid) return;
  await s.supabase.from('vendor_packages').delete().eq('id', pid);
  revalidatePath(`/vendor/profile/${vid}`);
}

// ---------------------------------------------------------------------------
// Admin review
// ---------------------------------------------------------------------------
export async function reviewVendor(_prev, fd) {
  const s = await session();
  const vid = id(fd);
  if (s.error || !vid) return { error: s.error ?? 'Vendor not found.' };
  const decision = str(fd.get('decision'), 10);
  const note = str(fd.get('note'), 1000);
  if (!['verified', 'rejected'].includes(decision)) return { error: 'Choose verify or reject.' };
  if (decision === 'rejected' && !note) return { error: 'Tell the vendor what to fix.' };
  const { data, error } = await s.supabase.from('vendors')
    .update({ verification_status: decision, review_note: note || null }).eq('id', vid).select('verification_status').maybeSingle();
  // The guard trigger silently keeps the old status for non-admins, so check what was saved.
  if (error || data?.verification_status !== decision) return { error: 'Only admins can review vendors.' };
  revalidatePath('/admin');
  revalidatePath('/vendors');
  return { ok: true, message: decision === 'verified' ? 'Verified. The vendor now appears in search.' : 'Sent back with your note.' };
}

// ---------------------------------------------------------------------------
// Bookings: messages, quotes, holds, confirmation, invoices, reviews
// ---------------------------------------------------------------------------
function bookingPaths(bid) {
  revalidatePath(`/bookings/${bid}`);
  revalidatePath(`/vendor/bookings/${bid}`);
}

export async function sendMessage(_prev, fd) {
  const s = await session();
  const bid = id(fd, 'booking_id');
  const body = str(fd.get('body'), 4000);
  if (s.error || !bid) return { error: s.error ?? 'Booking not found.' };
  if (!body) return { error: 'Write a message first.' };
  const { error } = await s.supabase.from('messages').insert({ event_vendor_id: bid, body, sender_id: s.user.id });
  if (error) return { error: 'Could not send the message.' };
  bookingPaths(bid);
  return { ok: true, message: 'Sent.', reset: Date.now() };
}

export async function sendQuote(_prev, fd) {
  const s = await session();
  const bid = id(fd, 'booking_id');
  if (s.error || !bid) return { error: s.error ?? 'Booking not found.' };
  const cents = dollarsToCents(fd.get('amount'));
  const description = str(fd.get('description'), 2000);
  const validUntil = str(fd.get('valid_until'), 10);
  if (!cents) return { error: 'Enter the quote amount in dollars.' };
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { error: 'Use a valid date.' };
  if (fd.get('confirm') !== 'yes') return { error: 'Confirm the quote before sending.' };
  const { error } = await s.supabase.from('quotes').insert({ event_vendor_id: bid, amount_cents: cents, description: description || null, valid_until: validUntil || null });
  if (error) return { error: 'Could not send the quote. The booking may be closed.' };
  bookingPaths(bid);
  return { ok: true, message: 'Quote sent. The customer sees it next to the AI estimate.' };
}

async function setBookingStatus(fd, status, extra = {}) {
  const s = await session();
  const bid = id(fd, 'booking_id');
  if (s.error || !bid) return { error: s.error ?? 'Booking not found.' };
  if (fd.get('confirm') !== 'yes') return { error: 'Tick the box to confirm.' };
  const { data, error } = await s.supabase.from('event_vendors').update({ status, ...extra }).eq('id', bid).select('status').maybeSingle();
  if (error) return { error: dbMessage(error, 'That change is not allowed right now.') };
  if (!data) return { error: 'That change is not allowed for your account.' };
  bookingPaths(bid);
  revalidatePath('/dashboard');
  return { ok: true, message: `Booking ${status}.` };
}

export async function placeHold(_prev, fd) {
  const days = Math.min(14, Math.max(1, Number(str(fd.get('days'), 2)) || 7));
  return setBookingStatus(fd, 'hold', { hold_expires_at: new Date(Date.now() + days * 864e5).toISOString() });
}
export async function confirmBooking(_prev, fd) { return setBookingStatus(fd, 'confirmed'); }
export async function cancelBooking(_prev, fd) { return setBookingStatus(fd, 'cancelled'); }

export async function respondToQuote(_prev, fd) {
  const s = await session();
  const qid = id(fd, 'quote_id'); const bid = id(fd, 'booking_id');
  if (s.error || !qid) return { error: s.error ?? 'Quote not found.' };
  const accept = str(fd.get('decision'), 10) === 'accept';
  const { error } = await s.supabase.rpc('respond_to_quote', { q: qid, accept });
  if (error) return { error: dbMessage(error, 'Could not answer this quote.') };
  bookingPaths(bid);
  return { ok: true, message: accept ? 'Quote accepted. Confirm the booking when you are ready.' : 'Quote declined.' };
}

export async function createInvoice(_prev, fd) {
  const s = await session();
  const bid = id(fd, 'booking_id');
  if (s.error || !bid) return { error: s.error ?? 'Booking not found.' };
  const kind = str(fd.get('kind'), 12);
  const cents = dollarsToCents(fd.get('amount'));
  const due = str(fd.get('due_date'), 10);
  if (!['deposit', 'installment', 'final'].includes(kind)) return { error: 'Choose the invoice type.' };
  if (!cents) return { error: 'Enter the amount in dollars.' };
  const { error } = await s.supabase.from('invoices').insert({ event_vendor_id: bid, kind, amount_cents: cents, due_date: due || null, note: str(fd.get('note'), 500) || null });
  if (error) return { error: 'Invoices can be added once the booking is on hold or confirmed.' };
  bookingPaths(bid);
  return { ok: true, message: 'Invoice added.' };
}

export async function setInvoiceStatus(_prev, fd) {
  const s = await session();
  const iid = id(fd, 'invoice_id'); const bid = id(fd, 'booking_id');
  const status = str(fd.get('status'), 6);
  if (s.error || !iid) return { error: s.error ?? 'Invoice not found.' };
  if (fd.get('confirm') !== 'yes') return { error: 'Tick the box to confirm.' };
  const { error } = await s.supabase.rpc('set_invoice_status', { i: iid, s: status });
  if (error) return { error: dbMessage(error, 'That change is not allowed.') };
  bookingPaths(bid);
  return { ok: true, message: status === 'paid' ? 'Payment recorded.' : 'Invoice voided.' };
}

export async function submitReview(_prev, fd) {
  const s = await session();
  const bid = id(fd, 'booking_id'); const vid = id(fd, 'vendor_id');
  if (s.error || !bid || !vid) return { error: s.error ?? 'Booking not found.' };
  const rating = Number(str(fd.get('rating'), 1));
  const body = str(fd.get('body'), 2000);
  if (!(rating >= 1 && rating <= 5)) return { error: 'Choose a rating from 1 to 5.' };
  if (body.length < 10) return { error: 'Write at least a sentence.' };
  const { error } = await s.supabase.from('reviews').insert({ event_vendor_id: bid, vendor_id: vid, rating, body });
  if (error?.code === '23505') return { error: 'You already reviewed this booking.' };
  if (error) return { error: 'Reviews open after the event date of a confirmed booking.' };
  bookingPaths(bid);
  revalidatePath(`/vendors/${vid}`);
  return { ok: true, message: 'Thanks. Your review is on the vendor’s profile.' };
}

// ---------------------------------------------------------------------------
// Favorites, account, notifications
// ---------------------------------------------------------------------------
export async function toggleFavorite(fd) {
  const s = await session();
  const vid = id(fd, 'vendor_id');
  if (s.error || !vid) return;
  if (fd.get('on') === '1') await s.supabase.from('favorites').insert({ vendor_id: vid, user_id: s.user.id });
  else await s.supabase.from('favorites').delete().eq('vendor_id', vid);
  revalidatePath(`/vendors/${vid}`);
  revalidatePath('/favorites');
}

export async function updateAccount(_prev, fd) {
  const s = await session();
  if (s.error) return { error: s.error };
  const name = str(fd.get('display_name'), 120);
  if (!name) return { error: 'Enter a name.' };
  const { error } = await s.supabase.from('profiles').update({ display_name: name }).eq('id', s.user.id);
  if (error) return { error: 'Could not save.' };
  revalidatePath('/account');
  return { ok: true, message: 'Saved.' };
}

export async function addRole(fd) {
  const s = await session();
  const r = str(fd.get('role'), 12);
  if (s.error) return;
  await s.supabase.rpc('add_my_role', { r });
  revalidatePath('/account');
}

export async function markNotificationsRead() {
  const s = await session();
  if (s.error) return;
  await s.supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Cohosts
// ---------------------------------------------------------------------------
export async function inviteCohost(_prev, fd) {
  const s = await session();
  const eid = id(fd, 'event_id');
  const email = str(fd.get('email'), 200).toLowerCase();
  if (s.error || !eid) return { error: s.error ?? 'Event not found.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email.' };
  if (email === (s.user.email ?? '').toLowerCase()) return { error: 'That is your own email.' };
  const { error } = await s.supabase.from('event_invites').insert({ event_id: eid, email, created_by: s.user.id });
  if (error?.code === '23505') return { error: 'That person is already invited.' };
  if (error) return { error: 'Only the event owner can invite cohosts.' };
  revalidatePath(`/events/${eid}`);
  return { ok: true, message: 'Invite link created. Copy it below and send it yourself.' };
}

export async function removeCohost(fd) {
  const s = await session();
  const eid = id(fd, 'event_id');
  if (s.error || !eid) return;
  const inviteId = id(fd, 'invite_id'); const userId = id(fd, 'user_id');
  if (inviteId) await s.supabase.from('event_invites').delete().eq('id', inviteId);
  if (userId) await s.supabase.from('event_members').delete().eq('event_id', eid).eq('user_id', userId);
  revalidatePath(`/events/${eid}`);
}

export async function acceptInvite(fd) {
  const s = await session();
  const token = id(fd, 'token');
  if (s.error || !token) redirect('/dashboard');
  const { data, error } = await s.supabase.rpc('accept_invite', { t: token });
  if (error) redirect(`/invites/${token}?error=${encodeURIComponent(dbMessage(error, 'This invite could not be used.'))}`);
  revalidatePath('/dashboard');
  redirect(`/events/${data}`);
}

// ---------------------------------------------------------------------------
// Sponsor leads (nothing is sent from Vendora)
// ---------------------------------------------------------------------------
export async function saveSponsorLead(_prev, fd) {
  const s = await session();
  const eid = id(fd, 'event_id');
  if (s.error || !eid) return { error: s.error ?? 'Event not found.' };
  const name = str(fd.get('name'), 200);
  const url = str(fd.get('url'), 2000);
  if (!name) return { error: 'Missing the sponsor name.' };
  if (url && !/^https?:\/\//.test(url)) return { error: 'That link is not valid.' };
  const { error } = await s.supabase.from('sponsor_leads').insert({ event_id: eid, name, url: url || null, reason: str(fd.get('reason'), 1000) || null });
  if (error) return { error: 'Only the event owner can add sponsor leads.' };
  revalidatePath(`/events/${eid}/sponsors`);
  return { ok: true, message: 'Added to your list.' };
}

export async function updateSponsorLead(_prev, fd) {
  const s = await session();
  const lid = id(fd); const eid = id(fd, 'event_id');
  if (s.error || !lid) return { error: s.error ?? 'Lead not found.' };
  const patch = {};
  const status = str(fd.get('status'), 12);
  if (status) {
    if (!['idea', 'approved', 'contacted', 'agreed', 'declined'].includes(status)) return { error: 'Unknown status.' };
    patch.status = status;
  }
  if (fd.has('proposal')) patch.proposal = str(fd.get('proposal'), 6000) || null;
  const { error } = await s.supabase.from('sponsor_leads').update(patch).eq('id', lid);
  if (error) return { error: 'Could not save.' };
  revalidatePath(`/events/${eid}/sponsors`);
  return { ok: true, message: 'Saved.' };
}

export async function deleteSponsorLead(fd) {
  const s = await session();
  const lid = id(fd); const eid = id(fd, 'event_id');
  if (s.error || !lid) return;
  await s.supabase.from('sponsor_leads').delete().eq('id', lid);
  revalidatePath(`/events/${eid}/sponsors`);
}
