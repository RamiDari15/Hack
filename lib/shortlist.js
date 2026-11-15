import 'server-only';
import { ANN_ARBOR, milesFrom, lowestPublished } from '@/lib/vendor-facts';
import { readBudgetOption } from '@/lib/vendor-pricing';

const FIELDS = 'id, vendor_id, added_by, in_package, planned_cents, pricing_selection, created_at, vendors(id, name, category, city, latitude, longitude, verification_status, directory_listed, portfolio_photos, booking_policy, setup_requirements, description, website, service_radius_mi, vendor_packages(title, price_cents, description))';

// Everything the shortlist, compare and package pages need for one event, in one place.
export async function loadShortlist(supabase, eventId, event) {
  const [{ data: rows }, { data: votes }, { data: comments }, { data: people }, { data: bookings }] = await Promise.all([
    supabase.from('event_shortlist').select(FIELDS).eq('event_id', eventId).order('created_at'),
    supabase.from('shortlist_votes').select('shortlist_id, user_id, vote'),
    supabase.from('shortlist_comments').select('id, shortlist_id, user_id, body, created_at').order('created_at'),
    supabase.rpc('event_people', { e: eventId }),
    supabase.from('event_vendors').select('id, vendor_id, status, quotes(amount_cents, status, created_at, description)').eq('event_id', eventId),
  ]);
  const names = Object.fromEntries((people ?? []).map((p) => [p.user_id, p.display_name]));
  const byVendorBooking = Object.fromEntries((bookings ?? []).map((b) => [b.vendor_id, b]));
  const nearAnnArbor = /ann\s+arbor/i.test(event?.location ?? '');
  const items = (rows ?? []).map((r) => {
    const v = r.vendors ?? {};
    const myVotes = (votes ?? []).filter((x) => x.shortlist_id === r.id);
    const booking = byVendorBooking[r.vendor_id] ?? null;
    const quotes = [...(booking?.quotes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const quote = quotes.find((q) => q.status === 'accepted') ?? quotes.find((q) => q.status === 'sent') ?? null;
    return {
      id: r.id, vendorId: r.vendor_id, addedById: r.added_by, inPackage: r.in_package, plannedCents: r.planned_cents, pricingSelection: r.pricing_selection, addedBy: names[r.added_by] ?? 'Someone',
      name: v.name, category: v.category, city: v.city, verified: v.verification_status === 'verified', listing: v.directory_listed,
      photo: (v.portfolio_photos ?? [])[0] ?? null, photos: v.portfolio_photos ?? [],
      policy: v.booking_policy ?? '', setup: v.setup_requirements ?? '', description: v.description ?? '', website: v.website,
      serviceRadius: v.service_radius_mi,
      distanceMi: nearAnnArbor ? milesFrom(ANN_ARBOR, v.latitude, v.longitude) : null,
      lowest: lowestPublished(v.vendor_packages),
      services: (v.vendor_packages ?? []).filter((p) => !readBudgetOption(p.description)).map((p) => ({ title: p.title, cents: p.price_cents })),
      up: myVotes.filter((x) => x.vote === 1).length, down: myVotes.filter((x) => x.vote === -1).length,
      voters: myVotes.map((x) => ({ name: names[x.user_id] ?? 'Someone', vote: x.vote, userId: x.user_id })),
      comments: (comments ?? []).filter((c) => c.shortlist_id === r.id).map((c) => ({ ...c, author: names[c.user_id] ?? 'Someone' })),
      booking, quote,
    };
  });
  return { items, people: people ?? [] };
}

// The amount the package uses for a pick, and where it came from. Order: accepted quote, latest
// quote, the owner's planned amount, the business's published flat price (per person x guests).
export function pickCost(item, guests) {
  if (item.quote?.status === 'accepted') return { cents: item.quote.amount_cents, source: 'Accepted quote' };
  if (item.quote) return { cents: item.quote.amount_cents, source: 'Quote received' };
  if (item.plannedCents != null) return { cents: item.plannedCents, source: item.pricingSelection?.source==='published'?'Published price for planning':'Your planned amount' };
  if (item.lowest) {
    if (item.lowest.unit === 'event') return { cents: item.lowest.cents, source: 'Published starting price' };
    if (item.lowest.unit === 'person' && guests) return { cents: item.lowest.cents * guests, source: `Published per-person price × ${guests}` };
  }
  return null;
}
