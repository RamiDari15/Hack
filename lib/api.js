import 'server-only';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';

export const jsonError = (message, status) => NextResponse.json({ error: message }, { status });

export async function readJson(request, maxBytes = 16_000) {
  const text = await request.text();
  if (text.length > maxBytes) return { error: 'Request is too large.' };
  try { return { body: JSON.parse(text) }; } catch { return { error: 'Request body must be JSON.' }; }
}

// Signed-in user plus a per-user daily limit across AI and search requests.
// The count reads ai_requests, which RLS limits to the user's own rows.
export async function requireUserWithinLimit() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: jsonError('Sign-in is not configured yet. Connect Supabase first.', 503) };
  if (!user) return { error: jsonError('Sign in to use this feature.', 401) };
  const limit = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 20);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error } = await supabase.from('ai_requests').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if (error) return { error: jsonError('Could not check your usage. Have the database migrations been applied?', 503) };
  if ((count ?? 0) >= limit) return { error: jsonError(`You have reached today’s limit of ${limit} AI and search requests. Try again tomorrow.`, 429) };
  return { supabase, user, remaining: limit - (count ?? 0) };
}

export async function fetchWithTimeout(url, options, ms = 30_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal: ctrl.signal, cache: 'no-store' }); } finally { clearTimeout(t); }
}
