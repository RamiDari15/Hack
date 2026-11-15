import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { firebaseRequest, authErrorMessage } from '@/lib/firebase/rest';
import { isFirebaseConfigured, ID_COOKIE } from '@/lib/firebase/config';
import { firebaseAdmin } from '@/lib/firebase/admin';
import { clearFirebaseCookies } from '@/lib/firebase/cookies';

export async function POST(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if (!isFirebaseConfigured) return NextResponse.json({ error: 'Unavailable.' }, { status: 503 });
  try {
    const token = (await cookies()).get(ID_COOKIE)?.value;
    if (!token) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
    let claims;
    try { claims = await firebaseAdmin().verifyIdToken(token, true); }
    catch { return NextResponse.json({ error: 'Your session has expired. Sign in again.' }, { status: 401 }); }
    // Match Firebase's recent-login requirement for sensitive account changes.
    if (!claims.email_verified || Date.now() / 1000 - claims.auth_time > 300) return NextResponse.json({ error: 'Sign out and sign in again before changing your password.' }, { status: 401 });
    const { password } = await request.json();
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) return NextResponse.json({ error: 'Use a password between 8 and 1024 characters.' }, { status: 400 });
    await firebaseRequest('update', { idToken: token, password, returnSecureToken: false });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    clearFirebaseCookies(response, new URL(request.url).protocol === 'https:');
    return response;
  } catch (error) { return NextResponse.json({ error: authErrorMessage(error) }, { status: 400 }); }
}
