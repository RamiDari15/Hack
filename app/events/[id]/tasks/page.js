import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { addTask, updateTask, deleteTask, importPlanTasks } from '@/app/actions/shared';

export const metadata = { title: 'Shared checklist' };

export default async function TasksPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/tasks`);
  const [{ data: event }, { data: tasks }, { data: people }, { count: planCount }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title').eq('id', id).maybeSingle(),
    supabase.from('event_tasks').select('*').eq('event_id', id).order('done').order('created_at'),
    supabase.rpc('event_people', { e: id }),
    supabase.from('ai_requests').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('kind', 'plan'),
  ]);
  if (!event) notFound();
  const names = Object.fromEntries((people ?? []).map((p) => [p.user_id, p.display_name]));
  const mineOnly = sp?.mine === '1';
  const list = (tasks ?? []).filter((t) => !mineOnly || t.assignee_id === user.id);
  const open = (tasks ?? []).filter((t) => !t.done).length;
  const hidden = <input type="hidden" name="event_id" value={event.id} />;
  const personSelect = (name, value, idAttr) => (
    <select id={idAttr} name={name} defaultValue={value ?? ''}>
      <option value="">Unassigned</option>
      {(people ?? []).map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}{p.user_id === user.id ? ' (you)' : ''}</option>)}
    </select>
  );

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Shared checklist" size="display-2"
        lede={`${open} open ${open === 1 ? 'task' : 'tasks'}. Everyone on the event can add, assign and tick tasks.`}>
        <Link className="btn btn-sm btn-outline" href={mineOnly ? `/events/${event.id}/tasks` : `/events/${event.id}/tasks?mine=1`}>{mineOnly ? 'Show all tasks' : 'Show my tasks'}</Link>
        <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/team`}>Invite people</Link>
      </PageHead>

      <div className="event-layout">
        <section className="panel stack" aria-labelledby="tasks-h">
          <h2 id="tasks-h">Tasks</h2>
          {list.length ? (
            <ul role="list" className="task-list">
              {list.map((t) => (
                <li key={t.id} className={t.done ? 'is-done' : undefined}>
                  <form action={updateTask}>{hidden}<input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done ? 'no' : 'yes'} />
                    <button type="submit" className="task-check" aria-label={`${t.done ? 'Reopen' : 'Mark done'}: ${t.title}`} aria-pressed={t.done}>{t.done ? '✓' : ''}</button></form>
                  <div className="stack-sm">
                    <p className="title">{t.title}</p>
                    <p className="fine">{[t.due_note, t.assignee_id ? `Owner: ${names[t.assignee_id] ?? 'Member'}` : 'Unassigned', t.source === 'ai' ? 'from the planner' : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  <form action={updateTask} className="row assign-form">{hidden}<input type="hidden" name="id" value={t.id} />
                    <label className="sr-only" htmlFor={`as-${t.id}`}>Owner for {t.title}</label>
                    {personSelect('assignee_id', t.assignee_id, `as-${t.id}`)}
                    <button className="btn btn-sm btn-outline" type="submit">Assign</button>
                  </form>
                  {(event.owner_id === user.id || t.created_by === user.id) && (
                    <form action={deleteTask}>{hidden}<input type="hidden" name="id" value={t.id} /><button className="btn btn-sm btn-outline" type="submit" aria-label={`Delete ${t.title}`}>Delete</button></form>
                  )}
                </li>
              ))}
            </ul>
          ) : <div className="empty"><h3>{mineOnly ? 'Nothing assigned to you' : 'No tasks yet'}</h3><p className="muted small">Add one, or bring in the planner’s suggested checklist.</p></div>}
        </section>
        <aside className="stack-lg">
          <section className="panel stack" aria-labelledby="add-task">
            <h2 id="add-task" className="title">Add a task</h2>
            <ActionForm action={addTask} resetOnOk>
              {hidden}
              <div className="field"><label htmlFor="tk-title">Task</label><input id="tk-title" name="title" required maxLength={200} /></div>
              <div className="field"><label htmlFor="tk-due">When (optional)</label><input id="tk-due" name="due_note" maxLength={80} placeholder="2 months before" /></div>
              <div className="field"><label htmlFor="tk-who">Owner</label>{personSelect('assignee_id', null, 'tk-who')}</div>
              <button className="btn" type="submit">Add task</button>
            </ActionForm>
          </section>
          {planCount > 0 && (
            <ActionForm action={importPlanTasks} className="panel panel-quiet stack-sm">
              {hidden}
              <p className="small">Copy the AI planner’s suggested checklist into shared tasks.</p>
              <div className="row"><button className="btn btn-sm btn-outline" type="submit">Add planner tasks</button></div>
            </ActionForm>
          )}
        </aside>
      </div>
    </div>
  );
}
