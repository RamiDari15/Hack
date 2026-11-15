// Sample data for demonstration only. Every record has sample: true and is labeled on screen.
// Nothing here is a real vendor, sponsor, price, review, or availability.

export const sampleVendors = [
  {
    id: 'sample-garden-hall', name: 'Sample Garden Hall', category: 'Venues', city: 'Ann Arbor, MI',
    serviceRadiusMi: 30, verification: 'verified',
    description: 'Sample description: an outdoor terrace with an indoor hall as a rain option. A real vendor writes this in their own words.',
    packages: [
      { title: 'Ceremony and reception', priceCents: 420000, note: 'Sample package' },
      { title: 'Reception only', priceCents: 280000, note: 'Sample package' },
    ],
    setupRequirements: 'Sample: power access and load-in window to be confirmed with the venue.',
    bookingPolicy: 'Sample: deposit to hold a date; cancellation terms are shown before booking.',
    sample: true,
  },
  {
    id: 'sample-floral-studio', name: 'Sample Floral Studio', category: 'Florists', city: 'Detroit, MI',
    serviceRadiusMi: 60, verification: 'verified',
    description: 'Sample description: seasonal arrangements and ceremony installations.',
    packages: [{ title: 'Table centerpieces (per table)', priceCents: 9000, note: 'Sample package' }],
    setupRequirements: 'Sample: delivery and setup window to be confirmed.',
    bookingPolicy: 'Sample: deposit required to hold a date.',
    sample: true,
  },
  {
    id: 'sample-table-co', name: 'Sample Table Co.', category: 'Catering', city: 'Ypsilanti, MI',
    serviceRadiusMi: 25, verification: 'pending',
    description: 'Sample description: seated and buffet service.',
    packages: [],
    setupRequirements: 'Sample: quote required.',
    bookingPolicy: 'Sample: quote required.',
    sample: true,
  },
  {
    id: 'sample-north-light', name: 'Sample North Light Photo', category: 'Photography', city: 'Ann Arbor, MI',
    serviceRadiusMi: 80, verification: 'verified',
    description: 'Sample description: documentary-style coverage for weddings and graduations.',
    packages: [{ title: 'Six hours of coverage', priceCents: null, note: 'Sample package · quote required' }],
    setupRequirements: 'Sample: shot list and timeline shared two weeks ahead.',
    bookingPolicy: 'Sample: retainer to hold a date.',
    sample: true,
  },
];

export const sampleBudget = [
  { name: 'Venue', low: 5500, high: 6500 },
  { name: 'Catering', low: 7800, high: 9200 },
  { name: 'Florals and decor', low: 2600, high: 3400 },
  { name: 'Photo and video', low: 2600, high: 3400 },
  { name: 'Music and DJ', low: 1600, high: 2400 },
  { name: 'Taxes, tips, delivery, setup, cleanup', low: 1500, high: 2100 },
  { name: 'Contingency', low: 2200, high: 2500 },
];

export const sampleDiscovery = {
  verified: [{ id: 'sample-garden-hall', title: 'Sample Garden Hall', note: 'Terrace and indoor hall. Availability to check on the calendar.' }],
  external: [
    { title: 'Sample Orchard Barn', note: 'External result. Pricing, capacity, and availability are not verified.' },
    { title: 'Sample Lakeside Pavilion', note: 'External result. Confirm details on the source page.' },
  ],
};

export const sampleSponsors = [
  { name: 'Sample Local Bakery', reason: 'Sample reason: audience and location overlap.', benefit: 'Booth and social mention' },
  { name: 'Sample Outdoor Gear Co.', reason: 'Sample reason: event theme and attendance.', benefit: 'Logo placement' },
  { name: 'Sample Credit Union', reason: 'Sample reason: local community focus. Eligibility to confirm.', benefit: 'Sponsor booth' },
];
