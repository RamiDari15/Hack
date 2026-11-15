import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import { listVendors } from '@/lib/vendors';
import { CATEGORIES } from '@/lib/categories';
import PageHead from '@/components/PageHead';
import EventWalk from '@/components/walk/EventWalk';
import { pickStops } from '@/components/walk/stations';

export const metadata = { title: 'Walk through your event' };

// Walk the room: one stop per vendor category, with what's picked, what's booked and who to add.
export default async function WalkPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/walk`);
  const { data: event } = await supabase.from('events').select('id, title, event_type, location').eq('id', id).maybeSingle();
  if (!event) notFound();

  const [{ data: shortlist }, { data: bookings }, { data: plans }] = await Promise.all([
    supabase.from('event_shortlist').select('id, vendor_id, vendors(id, name, category, city, verification_status)').eq('event_id', id).order('created_at'),
    supabase.from('event_vendors').select('id, status, vendor_id, vendors(id, name, category, city)').eq('event_id', id).neq('status', 'cancelled'),
    supabase.from('ai_requests').select('output->categories').eq('event_id', id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
  ]);
  const ballpark = Object.fromEntries((Array.isArray(plans?.[0]?.categories) ? plans[0].categories : [])
    .filter((c) => CATEGORIES.includes(c.name)).map((c) => [c.name, { low: c.low, high: c.high }]));

  const picked = (shortlist ?? []).filter((r) => r.vendors).map((r) => ({
    shortlistId: r.id, id: r.vendors.id, name: r.vendors.name, category: r.vendors.category, city: r.vendors.city, verified: r.vendors.verification_status === 'verified',
  }));
  const booked = (bookings ?? []).filter((r) => r.vendors).map((r) => ({
    bookingId: r.id, id: r.vendors.id, name: r.vendors.name, category: r.vendors.category, city: r.vendors.city, status: r.status,
  }));
  const categories = pickStops([...booked.map((b) => b.category), ...picked.map((p) => p.category), ...Object.keys(ballpark)]);

  // A few listed businesses per stop to add from: in the event's city first, then anywhere.
  const city = (event.location ?? '').split(',')[0].trim();
  const suggestions = Object.fromEntries(await Promise.all(categories.map(async (c) => {
    let { vendors } = await listVendors({ category: c, location: city || undefined, pageSize: 6 });
    if (!vendors?.length && city) ({ vendors } = await listVendors({ category: c, pageSize: 6 }));
    return [c, (vendors ?? []).map((v) => ({ id: v.id, name: v.name, city: v.city, verified: v.verification === 'verified' }))];
  })));

  return (
    <div className="page wrap walk-page">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Walk through your event" size="display-2"
        lede="Every stop is a part of the day. Pick one to see who you have, then add or remove vendors right there." />
      <EventWalk event={event} categories={categories} picked={picked} booked={booked} suggestions={suggestions} ballpark={ballpark} />
    </div>
  );
}
