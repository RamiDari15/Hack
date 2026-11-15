// Shared layout for the event walkthrough: which stops to show and where they stand.
// Used by the 3D scene and the flat floor plan, so both always agree.
import { CATEGORIES } from '@/lib/categories';

export const DEFAULT_STOPS = ['Venues', 'Catering', 'Music & DJ', 'Photography', 'Florists', 'Cake & desserts', 'Bar services', 'Photo booth'];
export const TONES = ['sun', 'pink', 'paper', 'ink'];

// Short names for the station signs.
export const SHORT = {
  'Music & DJ': 'Music', 'Cake & desserts': 'Cake', 'Hair & makeup': 'Hair & makeup', 'Decor & styling': 'Decor',
  'Bar services': 'Bar', 'Photo booth': 'Photo booth', Transportation: 'Rides',
};

// Pick up to 10 stops: anything already in play first, then the usual ones for a party.
export function pickStops(inPlay = [], max = 10) {
  const seen = new Set();
  const out = [];
  for (const c of [...inPlay, ...DEFAULT_STOPS]) {
    if (CATEGORIES.includes(c) && !seen.has(c)) { seen.add(c); out.push(c); }
    if (out.length >= max) break;
  }
  return out;
}

// Stops stand on an ellipse around the dance floor; the first one faces you.
export function stopPosition(i, n) {
  const a = (i / n) * Math.PI * 2 + Math.PI / 2;
  return { x: Math.cos(a) * 8.6, z: Math.sin(a) * 7.2, angle: a };
}

// Plan rows use free names ("Food and drink", "Venue rental"); match them to a vendor category.
const MATCH = [
  [/booth/i, 'Photo booth'], [/video|film/i, 'Videography'], [/photo/i, 'Photography'], [/venue|hall|space/i, 'Venues'],
  [/cake|dessert|sweet|bak/i, 'Cake & desserts'], [/bar\b|drink|alcohol|beverage|wine|cocktail/i, 'Bar services'],
  [/cater|food|menu|dinner|meal/i, 'Catering'], [/flor|flower|bouquet/i, 'Florists'], [/music|dj|band/i, 'Music & DJ'],
  [/hair|makeup|beauty/i, 'Hair & makeup'], [/transport|shuttle|limo|car\b|ride/i, 'Transportation'],
  [/rental|chair|tent|table|linen/i, 'Rentals'], [/planner|coordinat/i, 'Planners'], [/decor|styl|lighting/i, 'Decor & styling'],
  [/entertain|perform|magic/i, 'Entertainment'],
];
export function matchCategory(name = '') {
  if (CATEGORIES.includes(name)) return name;
  return MATCH.find(([re]) => re.test(name))?.[1] ?? null;
}
