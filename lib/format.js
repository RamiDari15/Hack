const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const money = (dollars) => (dollars == null || Number.isNaN(Number(dollars)) ? '—' : usd.format(dollars));
export const moneyCents = (cents) => (cents == null ? '—' : usd.format(cents / 100));

export function formatDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return 'Date not set';
  // Dates are stored as plain dates; parse at noon UTC so the day never shifts.
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? 'Date not set' : d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const BOOKING_STATUS = {
  inquiry: { label: 'Inquiry sent', tone: 'badge-info' },
  quote: { label: 'Quote received', tone: 'badge-accent' },
  hold: { label: 'Temporary hold', tone: 'badge-warn' },
  confirmed: { label: 'Confirmed', tone: 'badge-ok' },
  cancelled: { label: 'Cancelled', tone: 'badge-plain' },
};

export const VENDOR_STATUS = {
  pending: { label: 'In review', tone: 'badge-info' },
  verified: { label: 'Verified', tone: 'badge-ok' },
  rejected: { label: 'Needs changes', tone: 'badge-warn' },
};

// Database vendor row to the value keys VendorForm and parseVendor use.
export const vendorFormValues = (v) => ({
  name: v.name, category: v.category, city: v.city ?? '', radius: v.service_radius_mi ?? '', description: v.description ?? '',
  setup: v.setup_requirements ?? '', policy: v.booking_policy ?? '', legal: v.legal_name ?? '', businessId: v.business_id ?? '',
  website: v.website ?? '', email: v.contact_email ?? '', phone: v.phone ?? '',
});
