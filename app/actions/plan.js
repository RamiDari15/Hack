'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

const uuid = (v) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);
const title = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 200) : '');
const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// Turn items from an AI plan into real work: personal to-dos, event tasks, or both.
// RLS decides what is allowed: to-dos are always the caller's own; event tasks need access to the event.
export async function addPlanItems({ items, toTodos = true, eventId = null } = {}) {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return { error: 'Sign in to save these.' };
  const rows = (Array.isArray(items) ? items : []).map((i) => ({ title: title(i?.title), due: date(i?.due), when: title(i?.when).slice(0, 80) })).filter((i) => i.title).slice(0, 40);
  if (!rows.length) return { error: 'Nothing to add.' };
  const eid = uuid(eventId);
  let todos = 0, tasks = 0;
  if (toTodos) {
    const { error } = await supabase.from('user_todos').insert(rows.map((r) => ({ user_id: user.id, title: r.title, due_date: r.due, event_id: eid })));
    if (error) return { error: 'Could not add to your to-dos.' };
    todos = rows.length;
  }
  if (eid) {
    const { data: have } = await supabase.from('event_tasks').select('title').eq('event_id', eid);
    const seen = new Set((have ?? []).map((t) => t.title.toLowerCase()));
    const fresh = rows.filter((r) => !seen.has(r.title.toLowerCase()));
    if (fresh.length) {
      const due = (r) => (r.due ? `By ${new Date(`${r.due}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : r.when || null);
      const { error } = await supabase.from('event_tasks').insert(fresh.map((r) => ({ event_id: eid, title: r.title, due_note: due(r), created_by: user.id })));
      if (error) return { error: 'Could not add to that event. You need to be part of it.' };
    }
    tasks = fresh.length;
    revalidatePath(`/events/${eid}`);
    revalidatePath(`/events/${eid}/tasks`);
  }
  revalidatePath('/account');
  return { ok: true, todos, tasks };
}

export async function savePlanVendor(vendorId) {
  const { supabase, user } = await getSessionUser();
  const vid = uuid(vendorId);
  if (!supabase || !user || !vid) return { error: 'Sign in to save vendors.' };
  const { error } = await supabase.from('saved_vendors').upsert({ user_id: user.id, vendor_id: vid }, { onConflict: 'user_id,vendor_id', ignoreDuplicates: true });
  if (error) return { error: 'Could not save that vendor.' };
  revalidatePath('/saved');
  return { ok: true };
}

export async function shortlistPlanVendor(eventId, vendorId) {
  const { supabase, user } = await getSessionUser();
  const eid = uuid(eventId), vid = uuid(vendorId);
  if (!supabase || !user || !eid || !vid) return { error: 'Pick an event first.' };
  const { error } = await supabase.from('event_shortlist').insert({ event_id: eid, vendor_id: vid, added_by: user.id });
  if (error && error.code !== '23505') return { error: 'You can only shortlist for events you are part of.' };
  revalidatePath(`/events/${eid}/shortlist`);
  return { ok: true };
}
