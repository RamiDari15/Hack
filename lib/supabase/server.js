import 'server-only';
import { cache } from 'react';
import { createClient as createTokenClient } from '@supabase/supabase-js';
import { isFirebaseConfigured, ID_COOKIE } from '@/lib/firebase/config';
import { verifyFirebaseToken } from '@/lib/firebase/token';
import { firebaseAdmin } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config';

// Verify revocation once per request, including callers that only need a DB client.
const firebaseSession = cache(async () => {
  const token = (await cookies()).get(ID_COOKIE)?.value;
  if (!await verifyFirebaseToken(token)) return null;
  try { return { token, claims: await firebaseAdmin().verifyIdToken(token, true) }; }
  catch { return null; }
});

// Server client for Server Components, Server Actions, and Route Handlers.
// It reads the session from cookies, so the user's RLS policies apply to every query.
// Returns null when Supabase is not configured.
export async function createClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  if (isFirebaseConfigured) {
    const session = await firebaseSession();
    return createTokenClient(SUPABASE_URL, SUPABASE_ANON_KEY, { accessToken: async () => session?.token || null });
  }
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

// Returns { supabase, user }. user is null when signed out or when Supabase is not configured.
// getUser() checks the token with Supabase Auth instead of trusting the cookie.
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  if (isFirebaseConfigured) {
    const session = await firebaseSession();
    const claims = session?.claims;
    return { supabase, user: claims ? { id: claims.sub, email: claims.email, email_confirmed_at: new Date(claims.auth_time * 1000).toISOString() } : null };
  }
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
});
