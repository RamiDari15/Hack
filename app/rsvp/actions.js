'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Public RSVP. The guest's private token is the only key; the database function checks it,
// the event's guest list being on, the party size and the meal choice.
export async function respondRsvp(_prev, fd) {
  const token = String(fd.get('token') ?? '');
  if (!UUID_RE.test(token)) return { error: 'This RSVP link is not valid.' };
  const status = String(fd.get('status') ?? '');
  if (!['yes', 'no', 'maybe'].includes(status)) return { error: 'Choose whether you can come.' };
  const attending = status === 'no' ? 0 : Number(fd.get('attending') ?? 1);
  const supabase = await createClient();
  if (!supabase) return { error: 'RSVPs are not available right now.' };
  const { error } = await supabase.rpc('rsvp_respond', {
    t: token, s: status, n: Number.isInteger(attending) ? attending : -1,
    m: String(fd.get('meal') ?? '').slice(0, 80), d: String(fd.get('dietary') ?? '').slice(0, 300),
  });
  if (error) {
    const m = error.message ?? '';
    return { error: /^[A-Z][^\n]{3,120}\.$/.test(m) && !/violates|permission/i.test(m) ? m : 'Could not save your reply. Try again.' };
  }
  revalidatePath(`/rsvp/${token}`);
  return { ok: true, message: status === 'no' ? 'Thanks for letting us know.' : 'Thank you! Your reply is saved. You can change it any time with this link.' };
}

// A guest claims (or releases, with 0) a registry gift from their RSVP page.
export async function claimGift(_prev, fd) {
  const token = String(fd.get('token') ?? '');
  const item = String(fd.get('item_id') ?? '');
  if (!UUID_RE.test(token) || !UUID_RE.test(item)) return { error: 'This link is not valid.' };
  const n = Number(fd.get('quantity') ?? 0);
  const supabase = await createClient();
  if (!supabase) return { error: 'The registry is not available right now.' };
  const { error } = await supabase.rpc('registry_claim', { t: token, item, n: Number.isInteger(n) ? n : -1 });
  if (error) {
    const m = error.message ?? '';
    return { error: /^[A-Z][^\n]{3,120}\.$/.test(m) && !/violates|permission/i.test(m) ? m : 'Could not save. Try again.' };
  }
  revalidatePath(`/rsvp/${token}`);
  return { ok: true, message: n ? 'Marked as yours. Buy it from the store yourself.' : 'Released.' };
}
