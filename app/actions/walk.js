'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Add or remove vendors from an event's shortlist while walking through it. Row-level security decides
// who may change the event; these only check input and return the row the walkthrough needs.
const uuid = (v) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);
const refresh = (eid) => { for (const p of ['', '/shortlist', '/choose', '/package', '/walk']) revalidatePath(`/events/${eid}${p}`); };

export async function walkAddVendor(eventId, vendorId) {
  const { supabase, user } = await getSessionUser();
  const eid = uuid(eventId), vid = uuid(vendorId);
  if (!supabase || !user) return { error: 'Sign in again to continue.' };
  if (!eid || !vid) return { error: 'Pick an event first.' };
  const { data, error } = await supabase.from('event_shortlist').insert({ event_id: eid, vendor_id: vid, added_by: user.id }).select('id').maybeSingle();
  if (error?.code === '23505') {
    const { data: row } = await supabase.from('event_shortlist').select('id').eq('event_id', eid).eq('vendor_id', vid).maybeSingle();
    return { ok: true, id: row?.id ?? null, already: true };
  }
  if (error || !data) return { error: 'You can only add vendors to events you are part of.' };
  refresh(eid);
  return { ok: true, id: data.id };
}

export async function walkRemoveVendor(eventId, shortlistId) {
  const { supabase, user } = await getSessionUser();
  const eid = uuid(eventId), sid = uuid(shortlistId);
  if (!supabase || !user) return { error: 'Sign in again to continue.' };
  if (!eid || !sid) return { error: 'Not found.' };
  const { data, error } = await supabase.from('event_shortlist').delete().eq('id', sid).eq('event_id', eid).select('id');
  if (error || !data?.length) return { error: 'Only people on this event can change its vendors.' };
  refresh(eid);
  return { ok: true };
}
