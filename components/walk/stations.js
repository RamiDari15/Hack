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
