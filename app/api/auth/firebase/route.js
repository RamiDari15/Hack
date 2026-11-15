import { NextResponse } from 'next/server';
import { randomUUID, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { firebaseAdmin, existingIdentity, ensureIdentity, identityAdmin } from '@/lib/firebase/admin';
import { isFirebaseConfigured, UUID } from '@/lib/firebase/config';
import { firebaseRequest, authErrorMessage } from '@/lib/firebase/rest';
import { setFirebaseCookies } from '@/lib/firebase/cookies';
import { SUPABASE_URL, SUPABASE_ANON_KEY, safeNext } from '@/lib/supabase/config';

export const runtime = 'nodejs';
const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function throttle(request, action, email) {
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const secret = process.env.FIREBASE_ADMIN_CREDENTIAL;
  for (const scope of [`ip:${ip}`, `email:${email}`]) {
    const key = createHmac('sha256', secret).update(`${action}:${scope}`).digest('hex');
    const { data, error } = await identityAdmin().rpc('firebase_auth_attempt', {
      key_hash: key, window_seconds: action === 'sign-in' ? 600 : 3600,
      maximum: scope.startsWith('ip:') ? (action === 'sign-in' ? 120 : 60) : (action === 'sign-in' ? 20 : 6),
    });
    if (error) throw error;
    if (!data) { const e = new Error('TOO_MANY_ATTEMPTS'); e.status = 429; throw e; }
  }
}

async function findFirebase(email) {
  try { return await firebaseAdmin().getUserByEmail(email); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; return null; }
}

async function verificationEmail(idToken, request, next) {
  await firebaseRequest('sendOobCode', { requestType: 'VERIFY_EMAIL', idToken,
    continueUrl: `${new URL(request.url).origin}/sign-in?next=${encodeURIComponent(safeNext(next))}` });
}

export async function POST(request) {
  if (!isFirebaseConfigured) return json({ error: 'Sign-in is not configured.' }, 503);
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required.' }, 415);
  try {
    const text = await request.text();
    if (text.length > 8192) return json({ error: 'Request too large.' }, 413);
    const body = JSON.parse(text);
    const { action, password, audience } = body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!['sign-in', 'sign-up', 'reset', 'resend'].includes(action) || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400);
    if (action !== 'reset' && (typeof password !== 'string' || password.length < 8 || password.length > 1024)) return json({ error: 'Use a password between 8 and 1024 characters.' }, 400);
    await throttle(request, action, email);
    const admin = firebaseAdmin();
    if (action === 'reset') {
      // Legacy users can reset through Firebase before their first migrated login.
      if (!await findFirebase(email)) {
        const uid = await existingIdentity(email);
        if (uid) {
          try { await admin.createUser({ uid, email }); }
          catch (e) { if (e.code !== 'auth/email-already-exists' && e.code !== 'auth/uid-already-exists') throw e; }
        }
      }
      await firebaseRequest('sendOobCode', { requestType: 'PASSWORD_RESET', email,
        continueUrl: `${new URL(request.url).origin}/sign-in` });
      return json({ message: 'If that address has an account, a password reset link is on its way.' });
    }
    if (action === 'sign-up') {
      const uid = await existingIdentity(email) || randomUUID();
      await admin.createUser({ uid, email, password });
      const session = await firebaseRequest('signInWithPassword', { email, password, returnSecureToken: true });
      await verificationEmail(session.idToken, request, body.next);
      return json({ message: 'Check your email to confirm your account, then sign in.' });
    }
    let session;
    try { session = await firebaseRequest('signInWithPassword', { email, password, returnSecureToken: true }); }
    catch (error) {
      if (action !== 'sign-in' || !/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND/.test(error.code || '') || await findFirebase(email)) throw error;
      // Verify the old password before moving a confirmed existing account.
      const legacy = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error: legacyError } = await legacy.auth.signInWithPassword({ email, password });
      if (legacyError || !data.user?.email_confirmed_at) throw error;
      try { await admin.createUser({ uid: data.user.id, email, password, emailVerified: true }); }
      catch (e) { if (e.code !== 'auth/email-already-exists' && e.code !== 'auth/uid-already-exists') throw e; }
      await legacy.auth.signOut({ scope: 'local' });
      session = await firebaseRequest('signInWithPassword', { email, password, returnSecureToken: true });
    }
    const record = await admin.getUser(session.localId);
    if (action === 'resend') {
      if (!record.emailVerified) await verificationEmail(session.idToken, request, body.next);
      return json({ message: 'Check your inbox for your confirmation link, then sign in.' });
    }
    if (!record.emailVerified) throw new Error('EMAIL_NOT_VERIFIED');
    if (!UUID.test(record.uid)) throw new Error('Invalid identity');
    await ensureIdentity(record);
    // Obtain a fresh ID token with the server-assigned database role.
    session = await firebaseRequest('signInWithPassword', { email, password, returnSecureToken: true });
    if (audience === 'vendor') {
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { accessToken: async () => session.idToken });
      const { error } = await db.rpc('add_my_role', { r: 'vendor' });
      if (error) throw error;
    }
    const response = json({ next: safeNext(body.next) });
    setFirebaseCookies(response, session, new URL(request.url).protocol === 'https:');
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid request.' }, 400);
    // Never log credentials, passwords or provider response payloads.
    return json({ error: authErrorMessage(error) }, error.status || 400);
  }
}
