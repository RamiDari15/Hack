import { createRemoteJWKSet, jwtVerify } from 'jose';
import { FIREBASE_PROJECT_ID, UUID } from './config';

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

// Edge-compatible signature verification. Never accept another Firebase project's tokens.
export async function verifyFirebaseToken(token) {
  if (!token || !FIREBASE_PROJECT_ID) return null;
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'], audience: FIREBASE_PROJECT_ID,
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    });
    if (!UUID.test(payload.sub || '') || payload.role !== 'authenticated' || payload.email_verified !== true) return null;
    return payload;
  } catch { return null; }
}
