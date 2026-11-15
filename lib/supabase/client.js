'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './config';

// Browser client. Uses only the public URL and anon key; sessions are stored in cookies
// so the server and middleware see the same session.
let client;
export function createClient() {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
