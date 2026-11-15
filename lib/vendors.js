import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

const VENDOR_FIELDS = 'id, name, category, city, service_radius_mi, verification_status, description, setup_requirements, booking_policy, directory_listed, source_url, sourced_at, website, phone, instagram_url, street_address, portfolio_photos, published_hours, calendar_is_demo, demo_reviews, vendor_packages(title, price_cents, description)';

function fromRow(v) {
  return {
    id: v.id, name: v.name, category: v.category, city: v.city, serviceRadiusMi: v.service_radius_mi,
    verification: v.verification_status, description: v.description ?? '',
    setupRequirements: v.setup_requirements ?? '', bookingPolicy: v.booking_policy ?? '',
    packages: (v.vendor_packages ?? []).map((p) => ({ title: p.title, priceCents: p.price_cents, note: p.description ?? '' })),
    sourceUrl: v.source_url, sourcedAt: v.sourced_at, directoryListed: v.directory_listed,
    website: v.website, phone: v.phone, instagramUrl: v.instagram_url, address: v.street_address,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.street_address || v.city || ''}`)}`,
    googleReviewsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${v.name} ${v.city || ''} reviews`)}`,
    photos: v.portfolio_photos ?? [], publishedHours: v.published_hours,
    calendarIsDemo: v.calendar_is_demo, sample: false,
    demoReviews: v.demo_reviews ?? [],
  };
}

// Public research listings and verified businesses remain distinct throughout the UI.
export async function listVendors({ category, location, page = 1, pageSize = 24, verifiedOnly = false } = {}) {
  const supabase = await createClient();
  if (!supabase) {
    return { mode: 'offline', vendors: [], total: 0, error: 'Connect the database to browse vendors.' };
  }
  const nearAnnArbor = /^ann\s+arbor(?:,?\s+(?:mi|michigan))?$/i.test((location ?? '').trim());
  let query = (nearAnnArbor
    ? supabase.rpc('vendors_within_radius', { center_latitude: 42.2808, center_longitude: -83.7430, radius_miles: 25 }, { count: 'exact' })
    : supabase.from('vendors'))
    .select(VENDOR_FIELDS, { count: 'exact' })
    .order('directory_listed')
    .order('name')
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);
  query = verifiedOnly ? query.eq('verification_status', 'verified') : query.or('verification_status.eq.verified,directory_listed.eq.true');
  if (category) query = query.eq('category', category);
  if (location && !nearAnnArbor) query = query.ilike('city', `%${location.replace(/[%_,()]/g, '')}%`);
  const { data, error, count } = await query;
  return { mode: 'live', vendors: (data ?? []).map(fromRow), total: count ?? 0, error: error ? 'Could not load vendors right now.' : null };
}

export async function getVendor(id) {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('vendors')
    .select(VENDOR_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const { data: calendar } = await supabase.from('vendor_calendar_entries')
    .select('id, starts_at, ends_at, status, title, is_demo')
    .eq('vendor_id', id).order('starts_at').limit(100);
  return { ...fromRow(data), calendar: calendar ?? [] };
}
