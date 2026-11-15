import 'server-only';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase/config';
import { FIREBASE_PROJECT_ID } from './config';

export function firebaseAdmin() {
  const credential = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIAL || '{}');
  if (credential.project_id !== FIREBASE_PROJECT_ID) throw new Error('Firebase server project is not configured.');
  const app = getApps().find(a => a.name === 'vendora-auth') || initializeApp({ credential: cert(credential), projectId: FIREBASE_PROJECT_ID }, 'vendora-auth');
  return getAuth(app);
}

// Used only for server-side identity provisioning, never for application data queries.
export function identityAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Identity provisioning is not configured.');
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function existingIdentity(email) {
  const { data, error } = await identityAdmin().rpc('firebase_identity_id', { address: email });
  if (error) throw error;
  return data;
}

export async function ensureIdentity(record) {
  if (!record.emailVerified) throw new Error('EMAIL_NOT_VERIFIED');
  const admin = identityAdmin();
  const { data, error } = await admin.auth.admin.getUserById(record.uid);
  if (error && error.status !== 404) throw error;
  if (!data?.user) {
    const { error: createError } = await admin.auth.admin.createUser({ id: record.uid, email: record.email, email_confirm: true });
    if (createError) {
      // A simultaneous login may have provisioned the same identity.
      const { data: concurrent } = await admin.auth.admin.getUserById(record.uid);
      if (!concurrent?.user || concurrent.user.email?.toLowerCase() !== record.email?.toLowerCase()) throw createError;
    }
  } else if (data.user.email?.toLowerCase() !== record.email?.toLowerCase()) {
    throw new Error('Identity email mismatch');
  }
  // Only verified identities receive database access. Application roles remain in profiles.
  if (record.customClaims?.role !== 'authenticated') {
    await firebaseAdmin().setCustomUserClaims(record.uid, { ...record.customClaims, role: 'authenticated' });
  }
}
