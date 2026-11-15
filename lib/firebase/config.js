// Public project identifiers; administrative credentials are read only in admin.js.
export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
export const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
export const isFirebaseConfigured = Boolean(FIREBASE_PROJECT_ID && FIREBASE_API_KEY);
export const ID_COOKIE = 'vendora-firebase-id';
export const REFRESH_COOKIE = 'vendora-firebase-refresh';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
