import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sampleVendors } from '@/lib/sample-data';
import { UUID_RE } from '@/lib/format';

function fromRow(v) {
  return {
    id: v.id, name: v.name, category: v.category, city: v.city, serviceRadiusMi: v.service_radius_mi,
    verification: v.verification_status, description: v.description ?? '',
    setupRequirements: v.setup_requirements ?? '', bookingPolicy: v.booking_policy ?? '',
    packages: (v.vendor_packages ?? []).map((p) => ({ title: p.title, priceCents: p.price_cents, note: p.description ?? '' })),
    sample: false,
  };
}

// Verified vendors only (RLS also enforces this for other users' rows).
// mode is 'live' when Supabase answered, 'sample' when it is not configured.
export async function listVendors({ category, location } = {}) {
  const supabase = await createClient();
  if (!supabase) {
    const q = (location ?? '').toLowerCase().trim();
    const vendors = sampleVendors.filter((v) => (!category || v.category === category) && (!q || v.city.toLowerCase().includes(q)));
    return { mode: 'sample', vendors, error: null };
  }
  let query = supabase
    .from('vendors')
    .select('id, name, category, city, service_radius_mi, verification_status, description, vendor_packages(title, price_cents, description)')
    .eq('verification_status', 'verified')
    .order('name')
    .limit(60);
  if (category) query = query.eq('category', category);
  if (location) query = query.ilike('city', `%${location.replace(/[%_,()]/g, '')}%`);
  const { data, error } = await query;
  return { mode: 'live', vendors: (data ?? []).map(fromRow), error: error ? 'Could not load vendors right now.' : null };
}

export async function getVendor(id) {
  const sample = sampleVendors.find((v) => v.id === id);
  if (sample) return sample;
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('vendors')
    .select('id, name, category, city, service_radius_mi, verification_status, description, setup_requirements, booking_policy, vendor_packages(title, price_cents, description)')
    .eq('id', id)
    .maybeSingle();
  return data ? fromRow(data) : null;
}
