// One list of vendor categories, used by search, filters, the vendor form, and the database.
export const CATEGORIES = [
  'Venues', 'Catering', 'Photography', 'Videography', 'Florists', 'Music & DJ',
  'Cake & desserts', 'Hair & makeup', 'Transportation', 'Rentals', 'Planners',
  'Bar services', 'Photo booth', 'Decor & styling', 'Entertainment',
];

// Event types, grouped for the dropdowns; EVENT_TYPES is the flat list the server validates against.
export const EVENT_TYPE_GROUPS = [
  { label: 'Weddings and love', types: ['Wedding', 'Engagement party', 'Bridal shower', 'Bachelor or bachelorette party', 'Rehearsal dinner', 'Vow renewal', 'Anniversary'] },
  { label: 'Milestones', types: ['Birthday', 'Graduation', 'Baby shower', 'Gender reveal', 'Quinceañera', 'Sweet 16', 'Bar or bat mitzvah', 'Retirement party', 'Reunion', 'Prom or formal', 'Celebration of life'] },
  { label: 'Work', types: ['Corporate event', 'Conference', 'Holiday party', 'Product launch', 'Team offsite', 'Networking event', 'Awards night'] },
  { label: 'Community and culture', types: ['Community gathering', 'Fundraiser or gala', 'Festival', 'Concert', 'Religious celebration', 'Cultural celebration', 'Dinner party', 'Block party'] },
  { label: 'Something else', types: ['Other'] },
];
export const EVENT_TYPES = EVENT_TYPE_GROUPS.flatMap((g) => g.types);
// The short list shown on the homepage.
export const POPULAR_EVENT_TYPES = ['Wedding', 'Birthday', 'Graduation', 'Corporate event', 'Baby shower', 'Fundraiser or gala'];

export function isCategory(value) {
  return CATEGORIES.includes(value);
}
