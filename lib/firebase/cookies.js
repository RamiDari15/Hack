import { ID_COOKIE, REFRESH_COOKIE } from './config';
export function cookieOptions(secure, maxAge) {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge };
}
export function setFirebaseCookies(response, session, secure) {
  // Middleware restores a missing/expired ID token from the refresh cookie.
  response.cookies.set(ID_COOKIE, session.idToken, cookieOptions(secure, 3600));
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(secure, 30 * 86400));
}
export function clearFirebaseCookies(response, secure) {
  response.cookies.set(ID_COOKIE, '', cookieOptions(secure, 0));
  response.cookies.set(REFRESH_COOKIE, '', cookieOptions(secure, 0));
}
