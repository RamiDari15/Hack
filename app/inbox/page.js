import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { BOOKING_STATUS } from '@/lib/format';
import {completePlanningNote} from '@/app/actions/workspace';
import PageHead from '@/components/PageHead';
import { markAllThreadsRead } from '@/app/actions/inbox';

export const metadata = { title: 'Inbox' };

const when = (iso) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' });
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Detroit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Detroit' });
};

// Every conversation with a vendor (or, for vendors, with an organizer), newest first.
export default async function InboxPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/inbox');
  const [{data},{data:notes}]=await Promise.all([supabase.rpc('my_inbox'),supabase.from('event_notes').select('id,title,body,event_id,user_id,done,events(title)').order('created_at',{ascending:false}).limit(30)]);
  const all = data ?? [];
  const view = ['unread', 'vendor', 'notes'].includes(sp?.view) ? sp.view : 'all';
  const threads = all.filter((t) => (view === 'unread' ? t.unread > 0 : view === 'vendor' ? t.i_am_vendor : true));
  const unread = all.reduce((n, t) => n + t.unread, 0);
  const hasVendorSide = all.some((t) => t.i_am_vendor);

  return (
    <div className="page wrap">
      <PageHead title="Inbox" size="display-2" lede={unread ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}.` : `${notes?.length||0} private planning notes. Conversations appear as you contact connected vendors.`}>
        <Link className="btn btn-sm btn-outline" href="/tools/notes">＋ Add a planning note</Link>
        {unread > 0 && <form action={markAllThreadsRead}><button className="btn btn-sm btn-outline" type="submit">Mark all read</button></form>}
      </PageHead>
      <nav className="chips filter-chips" aria-label="Filter conversations">
        <Link className="chip" href="/inbox" aria-current={view === 'all' ? 'page' : undefined}>All ({all.length})</Link>
        <Link className="chip" href="/inbox?view=unread" aria-current={view === 'unread' ? 'page' : undefined}>Unread</Link>
        <Link className="chip" href="/inbox?view=notes" aria-current={view==='notes'?'page':undefined}>Planning notes ({notes?.length||0})</Link>
        {hasVendorSide && <Link className="chip" href="/inbox?view=vendor" aria-current={view === 'vendor' ? 'page' : undefined}>My business</Link>}
      </nav>
      {view!=='notes' && (threads.length ? (
        <ul role="list" className="inbox-list panel">
          {threads.map((t) => {
            const st = BOOKING_STATUS[t.status] ?? BOOKING_STATUS.inquiry;
            return (
              <li key={t.event_vendor_id} className={t.unread ? 'is-unread' : undefined}>
                <Link href={`/bookings/${t.event_vendor_id}`} className="inbox-row">
                  <span className="inbox-avatar" aria-hidden="true">{(t.i_am_vendor ? t.event_title : t.vendor_name || '?').replace(/^Sample /i, '').slice(0, 1)}</span>
                  <span className="inbox-main">
                    <span className="inbox-top"><b>{t.i_am_vendor ? t.event_title : t.vendor_name}</b><span className="fine">{when(t.last_at)}</span></span>
                    <span className="fine">{t.i_am_vendor ? `Request for ${t.vendor_name}` : t.event_title} · <span className={`badge badge-sm ${st.tone}`}>{st.label}</span></span>
                    <span className="inbox-preview small">{t.last_body ? `${t.last_from_me ? 'You: ' : ''}${t.last_body}` : 'No messages yet. Say hello.'}</span>
                  </span>
                  {t.unread > 0 && <span className="inbox-count" aria-label={`${t.unread} unread`}>{t.unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : view==='all'&&notes?.length ? null : (
        <div className="panel empty"><h3>{view === 'unread' ? 'No unread messages' : 'No conversations yet'}</h3>
          <p className="muted small">Ask a vendor for a quote and you’ll chat here.</p>
          <Link className="btn btn-sm" href="/vendors">Find vendors</Link></div>
      ) )}
      {(view==='all'||view==='notes')&&notes?.length>0&&<section className="stack" style={{marginTop:32}}><h2 className="display-3">Your planning desk</h2><p className="fine">Notes and inquiry drafts kept with your events. These have not been sent to any business.</p><div className="notes-grid">{notes.map(n=><article className="panel stack-sm" key={n.id}><div className="between"><Link className="fine" href={`/events/${n.event_id}`}>{n.events?.title}</Link><span className="badge">{n.done?'Done':'Private'}</span></div><h3 className="title">{n.title}</h3><p className="small muted">{n.body}</p><div className="row"><Link className="btn btn-sm btn-outline" href={`/events/${n.event_id}/notes`}>Open note</Link>{n.user_id===user.id&&<form action={completePlanningNote}><input type="hidden" name="id" value={n.id}/><input type="hidden" name="event_id" value={n.event_id}/><input type="hidden" name="done" value={n.done?'no':'yes'}/><button className="as-link small">{n.done?'Reopen':'Mark done'}</button></form>}</div></article>)}</div></section>}
    </div>
  );
}
