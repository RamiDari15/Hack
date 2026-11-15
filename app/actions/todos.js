'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Personal to-do list on /account. Writes go through the user's session, so RLS keeps each
// list private; event links must point at an event the user can see.
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const uuid = (v) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

async function session() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: 'The database is not connected yet.' };
  if (!user) return { error: 'Sign in again to continue.' };
  return { supabase, user };
}

export async function addTodo(_prev, fd) {
  const s = await session();
  if (s.error) return { error: s.error };
  const title = str(fd.get('title'), 200);
  if (!title) return { error: 'Write the to-do first.' };
  const due = str(fd.get('due_date'), 10);
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'Pick a valid date.' };
  const { error } = await s.supabase.from('user_todos').insert({ title, due_date: due || null, event_id: uuid(fd.get('event_id')), user_id: s.user.id });
  if (error) return { error: 'Could not add that to-do.' };
  revalidatePath('/account');
  return { ok: true, message: 'Added.' };
}

export async function toggleTodo(fd) {
  const s = await session();
  const id = uuid(fd.get('id'));
  if (s.error || !id) return;
  await s.supabase.from('user_todos').update({ done: fd.get('done') === 'yes' }).eq('id', id);
  revalidatePath('/account');
}

export async function deleteTodo(fd) {
  const s = await session();
  const id = uuid(fd.get('id'));
  if (s.error || !id) return;
  await s.supabase.from('user_todos').delete().eq('id', id);
  revalidatePath('/account');
}

export async function clearDoneTodos(fd) {
  const s = await session();
  if (s.error || fd.get('confirm') !== 'yes') return;
  await s.supabase.from('user_todos').delete().eq('done', true).eq('user_id', s.user.id);
  revalidatePath('/account');
}
