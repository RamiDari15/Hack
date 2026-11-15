import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { updateAccount } from '@/app/actions/marketplace';
import { addTodo, toggleTodo, deleteTodo, clearDoneTodos } from '@/app/actions/todos';

export const metadata = { title: 'Account' };

const ROLE = { customer: 'Planner', organizer: 'Organizer', vendor: 'Vendor', sponsor: 'Sponsor', admin: 'Admin' };
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => Math.round((new Date(`${d}T12:00:00Z`) - new Date(`${today()}T12:00:00Z`)) / 86400000);
const short = (d) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' });

export default async function AccountPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/account');

  const [{ data: profile }, { data: events }, { data: todos }, { data: assigned }, { data: vendors }, { data: plans }] = await Promise.all([
    supabase.from('profiles').select('display_name, email_alerts, roles, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('events').select('id, title, event_date, owner_id').order('event_date', { ascending: true, nullsFirst: false }).limit(50),
    supabase.from('user_todos').select('id, title, due_date, done, done_at, event_id, created_at').order('done').order('due_date', { ascending: true, nullsFirst: false }).order('created_at').limit(200),
    supabase.from('event_tasks').select('id, title, due_note, event_id, events(title)').eq('assignee_id', user.id).eq('done', false).order('created_at').limit(30),
    supabase.from('vendors').select('id').eq('owner_id', user.id).limit(1),
    supabase.from('ai_requests').select('id, created_at, event_id, output->summary, output->facts, output->categories').eq('user_id', user.id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(6),
  ]);
  const roles = profile?.roles ?? ['customer'];
  const isVendor = roles.includes('vendor') || (vendors ?? []).length > 0;
  const evs = events ?? [];
  const evName = Object.fromEntries(evs.map((e) => [e.id, e.title]));
  const upcoming = evs.filter((e) => e.event_date && e.event_date >= today());
  const next = upcoming[0];
  const open = (todos ?? []).filter((t) => !t.done);
  const done = (todos ?? []).filter((t) => t.done);
  const overdue = open.filter((t) => t.due_date && t.due_date < today()).length;
  const name = profile?.display_name || user.email.split('@')[0];

  return (
    <div className="page wrap">
      <PageHead back={{ href: '/dashboard', label: 'Your events' }} title={`Hi, ${name}`} size="display-2"
        lede={<>{user.email} · member since {short(profile?.created_at ?? user.created_at)}</>}>
        <div className="row">{roles.map((r) => <span key={r} className={`badge ${r === 'admin' ? 'badge-accent' : 'badge-plain'}`}>{ROLE[r] ?? r}</span>)}</div>
      </PageHead>

      <dl className="stat-strip">
        <div><dt>Events</dt><dd className="num">{evs.length}</dd></div>
        <div><dt>Next event</dt><dd className="num">{next ? (daysUntil(next.event_date) === 0 ? 'Today' : `${daysUntil(next.event_date)} days`) : '—'}</dd></div>
        <div><dt>Open to-dos</dt><dd className="num">{open.length}{overdue ? <span className="fine"> ({overdue} late)</span> : null}</dd></div>
        <div><dt>Event tasks for you</dt><dd className="num">{(assigned ?? []).length}</dd></div>
      </dl>

      <div className="event-layout">
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="todo-h">
            <div className="panel-head"><h2 id="todo-h">Your to-do list</h2></div>
            <ActionForm action={addTodo} resetOnOk className="todo-add">
              <div className="field todo-title"><label htmlFor="todo-title">To-do</label><input id="todo-title" name="title" maxLength={200} required placeholder="Call the florist about centerpieces" /></div>
              <div className="field"><label htmlFor="todo-due">Due (optional)</label><input id="todo-due" name="due_date" type="date" /></div>
              {evs.length > 0 && (
                <div className="field"><label htmlFor="todo-event">Event (optional)</label>
                  <select id="todo-event" name="event_id" defaultValue=""><option value="">No event</option>{evs.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
              )}
              <div className="row"><button className="btn" type="submit">Add to-do</button></div>
            </ActionForm>

            {open.length ? (
              <ul role="list" className="task-list">
                {open.map((t) => {
                  const late = t.due_date && t.due_date < today();
                  return (
                    <li key={t.id}>
                      <form action={toggleTodo}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value="yes" />
                        <button type="submit" className="task-check" aria-label={`Mark done: ${t.title}`} aria-pressed="false" /></form>
                      <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                        <p className="title">{t.title}</p>
                        <p className="fine">
                          {t.due_date ? <span className={late ? 'text-warn' : undefined}>{late ? 'Late, was due ' : 'Due '}{short(t.due_date)}</span> : 'No due date'}
                          {t.event_id && evName[t.event_id] ? <> · <Link href={`/events/${t.event_id}`}>{evName[t.event_id]}</Link></> : null}
                        </p>
                      </div>
                      <form action={deleteTodo}><input type="hidden" name="id" value={t.id} /><button className="btn btn-sm btn-outline" type="submit" aria-label={`Delete ${t.title}`}>Delete</button></form>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="small muted">{done.length ? 'All done. Nice.' : 'Nothing here yet. Add calls to make, deposits to send or things to buy.'}</p>}

            {done.length > 0 && (
              <details className="todo-done">
                <summary className="small">Finished ({done.length})</summary>
                <ul role="list" className="task-list">
                  {done.map((t) => (
                    <li key={t.id} className="is-done">
                      <form action={toggleTodo}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value="no" />
                        <button type="submit" className="task-check" aria-label={`Reopen: ${t.title}`} aria-pressed="true">✓</button></form>
                      <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}><p className="title">{t.title}</p>{t.done_at && <p className="fine">Done {short(t.done_at.slice(0, 10))}</p>}</div>
                    </li>
                  ))}
                </ul>
                <form action={clearDoneTodos}><input type="hidden" name="confirm" value="yes" /><button className="as-link fine" type="submit">Clear finished</button></form>
              </details>
            )}
          </section>

          <section className="panel stack" aria-labelledby="plans-h">
            <div className="panel-head"><h2 id="plans-h">Your plans</h2><Link className="small" href="/planner">New plan</Link></div>
            {plans?.length ? (
              <ul role="list" className="plan-list">
                {plans.map((p) => {
                  const cats = Array.isArray(p.categories) ? p.categories : [];
                  const low = cats.reduce((n, c) => n + (c.low || 0), 0), high = cats.reduce((n, c) => n + (c.high || 0), 0);
                  const f = p.facts || {};
                  return (
                    <li key={p.id}>
                      <Link href={`/plans/${p.id}`} className="plan-row">
                        <span className="plan-row-main">
                          <b>{f.type || 'Event'}{f.guests ? ` for ${f.guests}` : ''}{f.location ? `, ${f.location}` : ''}</b>
                          <span className="small muted">{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{p.event_id ? ' · saved to an event' : ''}</span>
                        </span>
                        {high > 0 && <span className="num small">${low.toLocaleString('en-US')} – ${high.toLocaleString('en-US')}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted small">Plans you build show up here, so you can come back and add their steps to your to-dos.</p>}
          </section>
          <section className="panel stack" aria-labelledby="asg-h">
            <h2 id="asg-h">Assigned to you on events</h2>
            {(assigned ?? []).length ? (
              <ul role="list" className="booking-list">
                {assigned.map((t) => (
                  <li key={t.id}><div><p className="title">{t.title}</p><p className="fine">{[t.events?.title, t.due_note].filter(Boolean).join(' · ')}</p></div>
                    <Link className="btn btn-sm btn-outline" href={`/events/${t.event_id}/tasks`}>Open</Link></li>
                ))}
              </ul>
            ) : <p className="small muted">When someone on a shared event gives you a task, it shows here.</p>}
          </section>

          <section className="panel stack" aria-labelledby="up-h">
            <div className="panel-head"><h2 id="up-h">Coming up</h2><Link className="small" href="/events/new">New event</Link></div>
            {upcoming.length ? (
              <ul role="list" className="booking-list">
                {upcoming.slice(0, 5).map((e) => (
                  <li key={e.id}><div><p className="title"><Link href={`/events/${e.id}`}>{e.title}</Link></p><p className="fine">{short(e.event_date)} · {daysUntil(e.event_date)} days{e.owner_id !== user.id ? ' · shared with you' : ''}</p></div></li>
                ))}
              </ul>
            ) : <p className="small muted">No dated events yet. <Link href="/events/new">Start one</Link>.</p>}
          </section>
        </div>

        <aside className="stack-lg">
          <section className="panel stack" aria-labelledby="acct-h">
            <h2 id="acct-h" className="title">Profile and alerts</h2>
            <ActionForm action={updateAccount}>
              <div className="field"><label htmlFor="display_name">Name</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} required maxLength={120} /></div>
              <label className="check-row"><input type="checkbox" name="email_alerts" defaultChecked={profile?.email_alerts ?? true} /><span>Email me when a quote, message or booking update arrives.</span></label>
              <div className="row"><button className="btn" type="submit">Save</button></div>
            </ActionForm>
          </section>
          <section className="panel stack-sm" aria-labelledby="sec-h">
            <h2 id="sec-h" className="title">Sign-in and security</h2>
            <p className="small">You sign in with <b>{user.email}</b> and a password.</p>
            <div className="row"><Link className="btn btn-sm btn-outline" href="/account/password">Change password</Link>
              <form action="/auth/sign-out" method="post"><button className="btn btn-sm btn-outline" type="submit">Sign out</button></form></div>
          </section>
          <section className="panel panel-quiet stack-sm" aria-labelledby="go-h">
            <h2 id="go-h" className="title">Go to</h2>
            <ul role="list" className="plain-list small">
              <li><Link href="/dashboard">Your events</Link></li>
              <li><Link href="/planner">AI planner</Link></li>
              <li><Link href="/vendors">Find vendors</Link></li>
              {isVendor ? <li><Link href="/vendor">Your vendor dashboard</Link></li> : <li><Link href="/vendor/apply">Run a business? Apply as a vendor</Link></li>}
              {roles.includes('admin') && <li><Link href="/admin">Vendor review (admin)</Link></li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
