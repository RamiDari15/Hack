'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

const uuid = (v) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

// Saved vendors: a personal list, private to the user (RLS).
export async function toggleSavedVendor(fd) {
  const { supabase, user } = await getSessionUser();
  const vid = uuid(fd.get('vendor_id'));
  if (!supabase || !user || !vid) return;
  if (fd.get('save') === 'yes') await supabase.from('saved_vendors').upsert({ user_id: user.id, vendor_id: vid }, { onConflict: 'user_id,vendor_id', ignoreDuplicates: true });
  else await supabase.from('saved_vendors').delete().eq('user_id', user.id).eq('vendor_id', vid);
  revalidatePath(`/vendors/${vid}`);
  revalidatePath('/saved');
}

export async function markAllThreadsRead() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return;
  const { data } = await supabase.rpc('my_inbox');
  const rows = (data ?? []).filter((t) => t.unread > 0).map((t) => ({ user_id: user.id, event_vendor_id: t.event_vendor_id, last_read_at: new Date().toISOString() }));
  if (rows.length) await supabase.from('message_reads').upsert(rows, { onConflict: 'user_id,event_vendor_id' });
  revalidatePath('/inbox');
  revalidatePath('/', 'layout');
}
