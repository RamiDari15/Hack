import { FIREBASE_API_KEY } from './config';

export async function firebaseRequest(method, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || 'AUTH_UNAVAILABLE');
    error.code = data.error?.message?.split(' : ')[0];
    throw error;
  }
  return data;
}

export async function refreshFirebaseToken(refreshToken) {
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }), cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return { idToken: data.id_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export function authErrorMessage(error) {
  const code = error.code || error.message || '';
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|user-not-found/.test(code)) return 'Email or password is wrong.';
  if (/EMAIL_EXISTS|email-already-exists/.test(code)) return 'That email already has an account. Sign in instead.';
  if (/TOO_MANY_ATTEMPTS|QUOTA_EXCEEDED|too-many-requests/.test(code)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/WEAK_PASSWORD|invalid-password/.test(code)) return 'Use at least 8 characters for your password.';
  if (/INVALID_EMAIL|invalid-email/.test(code)) return 'Enter a valid email address.';
  if (/EMAIL_NOT_VERIFIED/.test(code)) return 'Confirm your email first. Check your inbox for the link, or choose Resend confirmation.';
  if (/USER_DISABLED|user-disabled/.test(code)) return 'This account is disabled. Contact support.';
  return 'Sign-in is unavailable right now. Please try again shortly.';
}
