import { readBudgetOption } from '@/lib/vendor-pricing';

// Facts about a vendor computed from what it publishes. Used by filters, the shortlist and the
// side-by-side compare. Never mixes in Vendora's budget-guide ranges.

export const ANN_ARBOR = { lat: 42.2808, lng: -83.7430 };

export function milesFrom(center, lat, lng) {
  if (lat == null || lng == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat - center.lat);
  const dLng = toRad(lng - center.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(center.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// The lowest price the business itself publishes, with its unit. Null when it publishes none.
export function lowestPublished(packages) {
  let best = null;
  for (const p of packages ?? []) {
    const note = p.description ?? p.note ?? '';
    if (readBudgetOption(note)) continue;
    const cents = p.price_cents ?? p.priceCents;
    let value = null; let unit = 'event';
    if (cents != null) value = cents;
    else {
      const m = /Published (?:range|starting price): ([\d.]+)/.exec(note);
      if (m) value = Math.round(Number(m[1]) * 100);
      unit = /Per person\./.test(note) ? 'person' : /Per hour\./.test(note) ? 'hour' : 'event';
    }
    if (value != null && (!best || value < best.cents)) best = { cents: value, unit };
  }
  return best;
}
