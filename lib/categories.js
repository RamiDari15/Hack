// One list of vendor categories, used by search, filters, the vendor form, and the database.
export const CATEGORIES = [
  'Venues', 'Catering', 'Photography', 'Videography', 'Florists', 'Music & DJ',
  'Cake & desserts', 'Hair & makeup', 'Transportation', 'Rentals', 'Planners',
  'Bar services', 'Photo booth', 'Decor & styling', 'Entertainment',
];

export const EVENT_TYPES = ['Wedding', 'Graduation', 'Birthday', 'Corporate event', 'Community gathering', 'Other'];

export function isCategory(value) {
  return CATEGORIES.includes(value);
}
