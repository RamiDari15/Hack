import 'server-only';
import { CATEGORIES } from '@/lib/categories';
import { readBudgetOption } from '@/lib/vendor-pricing';

// Vendor walkthrough: which categories to choose, and how well each vendor fits one event.
// Every reason comes from data Vendora holds (published prices, the vendor's calendar,
// location, verification). Nothing here guesses availability or invents a price.

const DEFAULT_STEPS = {
  Wedding: ['Venues', 'Catering', 'Photography', 'Music & DJ', 'Florists', 'Cake & desserts', 'Rentals'],
  Graduation: ['Venues', 'Catering', 'Rentals', 'Photography', 'Cake & desserts'],
  Birthday: ['Venues', 'Catering', 'Cake & desserts', 'Entertainment', 'Decor & styling'],
  'Corporate event': ['Venues', 'Catering', 'Photography', 'Rentals', 'Entertainment'],
  'Community gathering': ['Venues', 'Catering', 'Rentals', 'Music & DJ'],
  'Fundraiser or gala': ['Venues', 'Catering', 'Bar services', 'Entertainment', 'Decor & styling', 'Photography'],
  Conference: ['Venues', 'Catering', 'Rentals', 'Photography'],
  'Baby shower': ['Venues', 'Catering', 'Cake & desserts', 'Decor & styling'],
  Quinceañera: ['Venues', 'Catering', 'Music & DJ', 'Photography', 'Cake & desserts', 'Decor & styling'],
  'Bar or bat mitzvah': ['Venues', 'Catering', 'Music & DJ', 'Photography', 'Entertainment'],
};

// Steps follow the AI estimate when there is one (its vendor categories, in its order).
export function walkthroughSteps(event, plan) {
  const fromPlan = (plan?.categories ?? []).filter((c) => CATEGORIES.includes(c.name));
  if (fromPlan.length) return fromPlan.map((c) => ({ category: c.name, lowCents: Math.round(c.low * 100), highCents: Math.round(c.high * 100), notes: c.notes }));
  return (DEFAULT_STEPS[event.event_type] ?? DEFAULT_STEPS.Wedding).map((category) => ({ category, lowCents: null, highCents: null, notes: '' }));
}

const usd = (c) => `$${Math.round(c / 100).toLocaleString('en-US')}`;

// A published price turned into an estimated cost for this event, when the unit allows it.
function packageCost(pack, guests) {
  if (readBudgetOption(pack.description)) return null; // Vendora's planning ranges, not this business's prices
  if (pack.price_cents != null) return { lowCents: pack.price_cents, highCents: pack.price_cents, label: `"${pack.title}" ${usd(pack.price_cents)}` };
  const note = pack.description ?? '';
  const range = /Published range: ([\d.]+)–([\d.]+) USD\./.exec(note);
  const starting = /Published starting price: ([\d.]+) USD\./.exec(note);
  if (!range && !starting) return null;
  const lo = Math.round(Number((range ?? starting)[1]) * 100);
  const hi = range ? Math.round(Number(range[2]) * 100) : lo;
  if (/Per person\./.test(note)) {
    if (!guests) return null;
    return { lowCents: lo * guests, highCents: hi * guests, label: `${usd(lo)}${hi !== lo ? `–${usd(hi)}` : ''} per person, about ${usd(lo * guests)}${hi !== lo ? `–${usd(hi * guests)}` : ''} for ${guests} guests` };
  }
  if (/Per hour\./.test(note)) return null; // event length is unknown, so a total would be a guess
  return { lowCents: lo, highCents: hi, label: `${range ? `${usd(lo)}–${usd(hi)}` : `from ${usd(lo)}`} published` };
}

function dateCheck(calendar, eventDate) {
  if (!eventDate) return { tone: 'plain', text: 'Add an event date to check calendars' };
  const day = eventDate.slice(0, 10);
  const hits = calendar.filter((c) => c.starts_at.slice(0, 10) <= day && c.ends_at.slice(0, 10) >= day);
  if (hits.some((c) => c.status === 'booked' || c.status === 'blocked')) return { tone: 'bad', text: 'Busy on your date in its Vendora calendar' };
  if (hits.some((c) => c.status === 'tentative')) return { tone: 'warn', text: 'Has a tentative hold on your date' };
  if (calendar.length) return { tone: 'ok', text: 'No conflict on its Vendora calendar. Confirm when you ask' };
  return { tone: 'plain', text: 'No calendar on Vendora. Ask about your date' };
}

// Scores each vendor for one step. Returns vendors sorted best first, each with plain reasons.
export function rankVendors({ vendors, calendars, event, step }) {
  const city = (event.location ?? '').split(',')[0].trim().toLowerCase();
  return vendors.map((v) => {
    const reasons = [];
    let score = 0;
    const verified = v.verification_status === 'verified';
    if (verified) { score += 3; reasons.push({ tone: 'ok', text: 'Verified by Vendora. You can request a quote here' }); }
    else reasons.push({ tone: 'plain', text: 'Public listing, not verified. Contact them directly' });

    if (city && (v.city ?? '').toLowerCase().includes(city)) { score += 1; reasons.push({ tone: 'ok', text: `Based in ${v.city}` }); }
    else if (v.city) reasons.push({ tone: 'plain', text: `Based in ${v.city}` });

    const costs = (v.vendor_packages ?? []).map((p) => packageCost(p, event.guest_count)).filter(Boolean);
    let price = null;
    if (costs.length) {
      // The package closest to the estimate's middle, so a small add-on doesn't stand in for the main service.
      const mid = step.highCents != null ? (step.lowCents + step.highCents) / 2 : 0;
      price = costs.reduce((a, b) => (Math.abs((a.lowCents + a.highCents) / 2 - mid) <= Math.abs((b.lowCents + b.highCents) / 2 - mid) ? a : b));
      if (step.highCents != null) {
        if (price.lowCents <= step.highCents && price.highCents >= (step.lowCents ?? 0) * 0.6) { score += 2; reasons.push({ tone: 'ok', text: `Fits your ${usd(step.lowCents)}–${usd(step.highCents)} estimate: ${price.label}` }); }
        else if (price.lowCents > step.highCents) { score -= 1; reasons.push({ tone: 'warn', text: `Above your ${usd(step.highCents)} estimate: ${price.label}` }); }
        else { score += 1; reasons.push({ tone: 'ok', text: `Below your estimate: ${price.label}` }); }
      } else reasons.push({ tone: 'plain', text: `Published price: ${price.label}` });
    } else reasons.push({ tone: 'plain', text: 'No published price. Ask for a quote' });

    const date = verified ? dateCheck(calendars[v.id] ?? [], event.event_date) : { tone: 'plain', text: 'Availability unknown. Ask about your date' };
    if (date.tone === 'bad') score -= 4; else if (date.tone === 'warn') score -= 1; else if (date.tone === 'ok') score += 1;
    reasons.push(date);

    return { id: v.id, name: v.name, category: v.category, city: v.city, verified, website: v.website, description: v.description ?? '', score, reasons, price, dateTone: date.tone };
  }).sort((a, b) => b.score - a.score || Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));
}

// Loads candidates for one category near the event, plus calendars for the verified ones.
export async function loadCandidates(supabase, event, category) {
  const fields = 'id, name, category, city, website, description, verification_status, directory_listed, vendor_packages(title, price_cents, description)';
  const nearAnnArbor = /ann\s+arbor/i.test(event.location ?? '');
  const city = (event.location ?? '').split(',')[0].replace(/[%_,()]/g, '').trim();
  const base = () => (nearAnnArbor
    ? supabase.rpc('vendors_within_radius', { center_latitude: 42.2808, center_longitude: -83.7430, radius_miles: 25 })
    : supabase.from('vendors')).select(fields).eq('category', category);
  const verifiedQ = supabase.from('vendors').select(fields).eq('category', category).eq('verification_status', 'verified');
  let listedQ = base().eq('directory_listed', true).limit(12);
  if (!nearAnnArbor && city) listedQ = listedQ.ilike('city', `%${city}%`);
  const [{ data: verified }, { data: listed }] = await Promise.all([verifiedQ.limit(12), city || nearAnnArbor ? listedQ : Promise.resolve({ data: [] })]);
  const byId = new Map();
  for (const v of [...(verified ?? []), ...(listed ?? [])]) byId.set(v.id, v);
  const vendors = [...byId.values()];
  const ids = vendors.filter((v) => v.verification_status === 'verified').map((v) => v.id);
  const calendars = {};
  if (ids.length) {
    const { data: entries } = await supabase.from('vendor_calendar_entries').select('vendor_id, starts_at, ends_at, status').in('vendor_id', ids);
    for (const e of entries ?? []) (calendars[e.vendor_id] ??= []).push(e);
  }
  return { vendors, calendars };
}
