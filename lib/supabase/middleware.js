import { isFirebaseConfigured, ID_COOKIE, REFRESH_COOKIE } from '@/lib/firebase/config';
import { verifyFirebaseToken } from '@/lib/firebase/token';
import { refreshFirebaseToken } from '@/lib/firebase/rest';
import { setFirebaseCookies, clearFirebaseCookies } from '@/lib/firebase/cookies';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config';

// Pages that need a signed-in user. API routes check the session themselves and return 401.
const PROTECTED = ['/dashboard', '/events', '/planner', '/vendor', '/admin', '/bookings', '/account', '/inbox', '/notifications', '/saved'];

export async function updateSession(request) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  if (isFirebaseConfigured) {
    let claims = await verifyFirebaseToken(request.cookies.get(ID_COOKIE)?.value);
    let session = null;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!claims && refresh) {
      try {
        session = await refreshFirebaseToken(refresh);
        claims = session && await verifyFirebaseToken(session.idToken);
      } catch { /* Provider outage must not grant access. */ }
      if (claims) {
        request.cookies.set(ID_COOKIE, session.idToken);
        request.cookies.set(REFRESH_COOKIE, session.refreshToken);
        response = NextResponse.next({ request });
        setFirebaseCookies(response, session, request.nextUrl.protocol === 'https:');
      } else {
        request.cookies.delete(ID_COOKIE);
        request.cookies.delete(REFRESH_COOKIE);
        response = NextResponse.next({ request });
        clearFirebaseCookies(response, request.nextUrl.protocol === 'https:');
      }
    }
    const path = request.nextUrl.pathname;
    if (!claims && PROTECTED.some(p => path === p || path.startsWith(`${p}/`))) {
      const url = request.nextUrl.clone();
      url.pathname = path === '/vendor' || path.startsWith('/vendor/') ? '/sign-in/vendor' : '/sign-in';
      url.search = '';
      url.searchParams.set('next', path + request.nextUrl.search);
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach(c => redirect.cookies.set(c));
      return redirect;
    }
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie when needed. Do not put code between createServerClient and getUser.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = path === '/vendor' || path.startsWith('/vendor/') ? '/sign-in/vendor' : '/sign-in';
    url.search = '';
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}
