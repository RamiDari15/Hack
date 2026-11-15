'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Shortlist, package picks, votes, comments and shared tasks. Row-level security decides who may
// do what (everyone on the event shortlists, votes, comments and works tasks; the owner picks the
// package); these actions validate input and give readable messages.

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (fd, key = 'id') => { const v = str(fd.get(key), 36); return UUID_RE.test(v) ? v : null; };

async function session(fd) {
  const { supabase, user } = await getSessionUser();
  if (!supabase) return { error: 'The database is not connected yet.' };
  if (!user) return { error: 'Sign in again to continue.' };
  const eid = id(fd, 'event_id');
  if (!eid) return { error: 'Event not found.' };
  return { supabase, user, eid };
}
const refresh = (eid, ...pages) => { revalidatePath(`/events/${eid}`); for (const p of pages) revalidatePath(`/events/${eid}/${p}`); };

// ---------------------------------------------------------------------------
// Shortlist and package
// ---------------------------------------------------------------------------
export async function addToShortlist(_prev, fd) {
  const s = await session(fd);
  const vid = id(fd, 'vendor_id');
  if (s.error || !vid) return { error: s.error ?? 'Vendor not found.' };
  const { error } = await s.supabase.from('event_shortlist').insert({ event_id: s.eid, vendor_id: vid, added_by: s.user.id });
  if (error?.code === '23505') return { ok: true, message: 'Already on this event’s shortlist.' };
  if (error) return { error: 'You can only shortlist for events you are part of.' };
  refresh(s.eid, 'shortlist', 'choose');
  return { ok: true, message: 'Added to the shortlist.' };
}

export async function removeFromShortlist(fd) {
  const s = await session(fd);
  const sid = id(fd);
  if (s.error || !sid) return;
  await s.supabase.from('event_shortlist').delete().eq('id', sid);
  refresh(s.eid, 'shortlist', 'package', 'choose');
}

export async function setPackagePick(_prev, fd) {
  const s = await session(fd);
  const sid = id(fd);
  if (s.error || !sid) return { error: s.error ?? 'Not found.' };
  const patch = {};
  if (fd.has('in_package')) patch.in_package = fd.get('in_package') === 'yes';
  if (fd.has('planned')) {
    const raw = str(fd.get('planned'), 12).replace(/[$,\s]/g, '');
    if (raw && !/^\d+(\.\d{1,2})?$/.test(raw)) return { error: 'Enter an amount in dollars.' };
    patch.planned_cents = raw ? Math.round(Number(raw) * 100) : null;
  }
  const { data, error } = await s.supabase.from('event_shortlist').update(patch).eq('id', sid).select('id');
  if (error || !data?.length) return { error: 'Only the event owner can change the package.' };
  refresh(s.eid, 'shortlist', 'package');
  return { ok: true, message: patch.in_package === false ? 'Removed from the package.' : 'Package updated.' };
}

export async function voteOnVendor(fd) {
  const s = await session(fd);
  const sid = id(fd, 'shortlist_id');
  const vote = Number(fd.get('vote'));
  if (s.error || !sid || ![-1, 0, 1].includes(vote)) return;
  if (vote === 0) await s.supabase.from('shortlist_votes').delete().eq('shortlist_id', sid).eq('user_id', s.user.id);
  else await s.supabase.from('shortlist_votes').upsert({ shortlist_id: sid, user_id: s.user.id, vote }, { onConflict: 'shortlist_id,user_id' });
  refresh(s.eid, 'shortlist');
}

export async function addShortlistComment(_prev, fd) {
  const s = await session(fd);
  const sid = id(fd, 'shortlist_id');
  const body = str(fd.get('body'), 1000);
  if (s.error || !sid) return { error: s.error ?? 'Not found.' };
  if (!body) return { error: 'Write a comment first.' };
  const { error } = await s.supabase.from('shortlist_comments').insert({ shortlist_id: sid, user_id: s.user.id, body });
  if (error) return { error: 'Could not post the comment.' };
  refresh(s.eid, 'shortlist');
  return { ok: true };
}

export async function deleteShortlistComment(fd) {
  const s = await session(fd);
  const cid = id(fd);
  if (s.error || !cid) return;
  await s.supabase.from('shortlist_comments').delete().eq('id', cid);
  refresh(s.eid, 'shortlist');
}

// ---------------------------------------------------------------------------
// Shared checklist
// ---------------------------------------------------------------------------
export async function addTask(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const title = str(fd.get('title'), 200);
  if (!title) return { error: 'Describe the task.' };
  const assignee = id(fd, 'assignee_id');
  const { error } = await s.supabase.from('event_tasks').insert({ event_id: s.eid, title, due_note: str(fd.get('due_note'), 80) || null, assignee_id: assignee, created_by: s.user.id });
  if (error) return { error: 'Could not add the task. The person must be on this event.' };
  refresh(s.eid, 'tasks');
  return { ok: true, message: 'Task added.' };
}

export async function updateTask(fd) {
  const s = await session(fd);
  const tid = id(fd);
  if (s.error || !tid) return;
  const patch = {};
  if (fd.has('done')) patch.done = fd.get('done') === 'yes';
  if (fd.has('assignee_id')) patch.assignee_id = id(fd, 'assignee_id');
  await s.supabase.from('event_tasks').update(patch).eq('id', tid);
  refresh(s.eid, 'tasks');
}

export async function deleteTask(fd) {
  const s = await session(fd);
  const tid = id(fd);
  if (s.error || !tid) return;
  await s.supabase.from('event_tasks').delete().eq('id', tid);
  refresh(s.eid, 'tasks');
}

// Copies the latest AI plan's checklist into shared tasks (once per task title).
export async function importPlanTasks(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const [{ data: plans }, { data: existing }] = await Promise.all([
    s.supabase.from('ai_requests').select('output').eq('event_id', s.eid).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
    s.supabase.from('event_tasks').select('title').eq('event_id', s.eid),
  ]);
  const have = new Set((existing ?? []).map((t) => t.title.toLowerCase()));
  const rows = (plans?.[0]?.output?.checklist ?? [])
    .filter((c) => c?.task && !have.has(String(c.task).toLowerCase()))
    .slice(0, 30)
    .map((c) => ({ event_id: s.eid, title: str(String(c.task), 200), due_note: str(String(c.when ?? ''), 80) || null, created_by: s.user.id, source: 'ai' }));
  if (!rows.length) return { ok: true, message: 'No new tasks in the plan.' };
  const { error } = await s.supabase.from('event_tasks').insert(rows);
  if (error) return { error: 'Could not add the planner’s tasks.' };
  refresh(s.eid, 'tasks');
  return { ok: true, message: `Added ${rows.length} tasks from the planner.` };
}

// ---------------------------------------------------------------------------
// Style boards
// ---------------------------------------------------------------------------
const SECTIONS = ['venue', 'flowers', 'decor', 'outfits', 'other'];

export async function addBoardItem(_prev, fd) {
  const s = await session(fd);
  if (s.error) return { error: s.error };
  const section = str(fd.get('section'), 12);
  if (!SECTIONS.includes(section)) return { error: 'Choose a section.' };
  const url = str(fd.get('image_url'), 2000);
  const data = typeof fd.get('image_data') === 'string' ? fd.get('image_data') : '';
  if (!url && !data) return { error: 'Choose a photo or paste an image link.' };
  if (url && !/^https:\/\//.test(url)) return { error: 'Image links must start with https://.' };
  if (data && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > 700000)) return { error: 'That photo could not be used. Try a JPEG or PNG under 10 MB.' };
  const { error } = await s.supabase.from('style_board_items').insert({
    event_id: s.eid, section, image_url: data ? null : url, image_data: data || null, caption: str(fd.get('caption'), 200) || null, added_by: s.user.id,
  });
  if (error) return { error: 'Could not save to the board.' };
  refresh(s.eid, 'board');
  return { ok: true, message: 'Added to the board.' };
}

export async function removeBoardItem(fd) {
  const s = await session(fd);
  const bid = id(fd);
  if (s.error || !bid) return;
  await s.supabase.from('style_board_items').delete().eq('id', bid);
  refresh(s.eid, 'board');
}
