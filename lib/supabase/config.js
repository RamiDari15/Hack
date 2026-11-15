// Supabase settings shared by the server, browser, and middleware clients.
// The app runs without Supabase (sample mode) so pages can be reviewed before a project exists.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const authProviders = {
  email: true,
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === 'true',
  ssojet: process.env.NEXT_PUBLIC_AUTH_SSOJET === 'true',
};

// Only allow same-site relative paths after sign-in, never an open redirect.
export function safeNext(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
