import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import { readBudgetOption } from '@/lib/vendor-pricing';
import { ANN_ARBOR, milesFrom, lowestPublished } from '@/lib/vendor-facts';

const VENDOR_FIELDS = 'id, latitude, longitude, name, category, city, service_radius_mi, verification_status, description, setup_requirements, booking_policy, directory_listed, source_url, sourced_at, website, phone, instagram_url, street_address, portfolio_photos, published_hours, calendar_is_demo, demo_reviews, vendor_packages(id, title, price_cents, description)';

export function normalizeVendor(v) {
  const budgetOptions = [];
  const packages = [];
  for (const pack of v.vendor_packages ?? []) {
    const budget = readBudgetOption(pack.description);
    if (budget) budgetOptions.push(budget);
    else packages.push({ id: pack.id, title: pack.title, priceCents: pack.price_cents, note: pack.description ?? '' });
  }
  budgetOptions.sort((a, b) => a.min_cents-b.min_cents);
  return {
    id: v.id, name: v.name, category: v.category, city: v.city, serviceRadiusMi: v.service_radius_mi,
    verification: v.verification_status, description: v.description ?? '',
    setupRequirements: v.setup_requirements ?? '', bookingPolicy: v.booking_policy ?? '',
    packages, budgetOptions,
    sourceUrl: v.source_url, sourcedAt: v.sourced_at, directoryListed: v.directory_listed,
    website: v.website, phone: v.phone, instagramUrl: v.instagram_url, address: v.street_address,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.street_address || v.city || ''}`)}`,
    googleReviewsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${v.name} ${v.city || ''} reviews`)}`,
    photos: v.portfolio_photos ?? [], publishedHours: v.published_hours,
    calendarIsDemo: v.calendar_is_demo, sample: false,
    demoReviews: v.demo_reviews ?? [],
    lowestPrice: lowestPublished(v.vendor_packages),
    distanceMi: milesFrom(ANN_ARBOR, v.latitude, v.longitude),
  };
}

// Public research listings and verified businesses remain distinct throughout the UI.
// Filters: category, location (Ann Arbor uses a real radius), verified only, has photos,
// maximum published starting price, and sort. Price filters and price sort run over at most
// 600 matches in the server, since prices live in each vendor's packages.
export async function listVendors({ category, location, page = 1, pageSize = 24, verifiedOnly = false, radius = 25, hasPhotos = false, maxPriceCents = null, sort = 'recommended' } = {}) {
  const supabase = await createClient();
  if (!supabase) {
    return { mode: 'offline', vendors: [], total: 0, error: 'Connect the database to browse vendors.' };
  }
  const nearAnnArbor = /^ann\s+arbor(?:,?\s+(?:mi|michigan))?$/i.test((location ?? '').trim());
  const inMemory = maxPriceCents != null || sort === 'price' || (sort === 'distance' && nearAnnArbor);
  let query = (nearAnnArbor
    ? supabase.rpc('vendors_within_radius', { center_latitude: ANN_ARBOR.lat, center_longitude: ANN_ARBOR.lng, radius_miles: radius }, { count: 'exact' })
    : supabase.from('vendors'))
    .select(VENDOR_FIELDS, { count: 'exact' })
    .order('directory_listed')
    .order('name')
    .order('id');
  query = inMemory ? query.limit(600) : query.range((page - 1) * pageSize, page * pageSize - 1);
  query = verifiedOnly ? query.eq('verification_status', 'verified') : query.or('verification_status.eq.verified,directory_listed.eq.true');
  if (category) query = query.eq('category', category);
  if (hasPhotos) query = query.neq('portfolio_photos', '[]');
  if (location && !nearAnnArbor) query = query.ilike('city', `%${location.replace(/[%_,()]/g, '')}%`);
  const { data, error, count } = await query;
  if (error) return { mode: 'live', vendors: [], total: 0, error: 'Could not load vendors right now.' };
  let vendors = (data ?? []).map(normalizeVendor);
  if (!inMemory) return { mode: 'live', vendors, total: count ?? 0, error: null };
  if (maxPriceCents != null) vendors = vendors.filter((v) => v.lowestPrice && v.lowestPrice.cents <= maxPriceCents);
  if (sort === 'price') vendors.sort((a, b) => (a.lowestPrice?.cents ?? Infinity) - (b.lowestPrice?.cents ?? Infinity));
  if (sort === 'distance') vendors.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
  const total = vendors.length;
  return { mode: 'live', vendors: vendors.slice((page - 1) * pageSize, page * pageSize), total, error: null, capped: (count ?? 0) > 600 };
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
  return { ...normalizeVendor(data), calendar: calendar ?? [] };
}
