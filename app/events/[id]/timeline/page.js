import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, BOOKING_STATUS, formatDate } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { addTimelineItem, removeTimelineItem, clearAiTimeline } from '@/app/actions/planning';
import TimelineTools from './TimelineTools';

export const metadata = { title: 'Day-of timeline' };

const hhmm = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export default async function TimelinePage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/timeline`);

  const [{ data: event }, { data: items }, { data: bookings }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, event_date, location').eq('id', id).maybeSingle(),
    supabase.from('event_timeline_items').select('*').eq('event_id', id).order('start_time').order('created_at'),
    supabase.from('event_vendors').select('id, status, vendors(name, category)').eq('event_id', id).in('status', ['confirmed', 'hold', 'quote']),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const list = items ?? [];
  const booked = (bookings ?? []).filter((b) => b.status === 'confirmed' || b.status === 'hold');
  const vendorFor = Object.fromEntries((bookings ?? []).map((b) => [b.id, b]));
  const hasAi = list.some((i) => i.source === 'ai');
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Day-of timeline" size="display-2"
        lede={[formatDate(event.event_date), event.location].filter(Boolean).join(', ') || 'When each vendor arrives, sets up and leaves.'} />
      <p><a className="btn btn-sm btn-outline" href={`/api/events/${id}/export?type=timeline`} download>Export CSV</a></p>

      <div className="event-layout">
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="tl-h">
            <div className="panel-head">
              <h2 id="tl-h">Run sheet</h2>
              <TimelineTools eventId={event.id} hasAi={hasAi} canDraft={isOwner} />
            </div>
            {isOwner && !booked.length && <p className="fine no-print">The AI draft uses your confirmed and held bookings. <Link href={`/events/${event.id}/choose`}>Choose vendors</Link> first for a fuller draft.</p>}
            {hasAi && <p className="fine">Items marked AI draft are suggestions. Confirm every arrival and setup time with the vendor.</p>}
            {list.length ? (
              <ol role="list" className="timeline">
                {list.map((it) => {
                  const b = it.event_vendor_id ? vendorFor[it.event_vendor_id] : null;
                  return (
                    <li key={it.id}>
                      <p className="timeline-time num">{hhmm(it.start_time)}{it.end_time ? <span className="fine"> to {hhmm(it.end_time)}</span> : null}</p>
                      <div className="stack-sm">
                        <p className="title">{it.title}</p>
                        <div className="row">
                          {b && <Link href={`/bookings/${b.id}`} className="badge badge-plain">{b.vendors?.name}</Link>}
                          {b && <span className={`badge ${(BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry).tone}`}>{(BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry).label}</span>}
                          {it.source === 'ai' && <span className="badge badge-warn">AI draft</span>}
                        </div>
                        {it.notes && <p className="small muted">{it.notes}</p>}
                      </div>
                      {isOwner && (
                        <form action={removeTimelineItem} className="no-print">{hidden}<input type="hidden" name="id" value={it.id} />
                          <button className="btn btn-sm btn-outline" type="submit" aria-label={`Remove ${it.title}`}>Remove</button></form>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : <div className="empty"><h3>Nothing on the timeline yet</h3><p className="muted small">Draft it with AI from your bookings, or add items yourself.</p></div>}
            {isOwner && hasAi && (
              <form action={clearAiTimeline} className="no-print">{hidden}<button className="btn btn-sm btn-outline" type="submit">Remove all AI draft items</button></form>
            )}
          </section>
        </div>

        {isOwner && (
          <aside className="stack-lg no-print">
            <section className="panel stack" aria-labelledby="add-t">
              <h2 id="add-t" className="title">Add an item</h2>
              <ActionForm action={addTimelineItem} resetOnOk>
                {hidden}
                <div className="row">
                  <div className="field"><label htmlFor="t-start">Start</label><input id="t-start" name="start_time" type="time" required /></div>
                  <div className="field"><label htmlFor="t-end">End (optional)</label><input id="t-end" name="end_time" type="time" /></div>
                </div>
                <div className="field"><label htmlFor="t-title">What happens</label><input id="t-title" name="title" required maxLength={160} placeholder="Caterer arrives and sets up" /></div>
                {bookings?.length > 0 && (
                  <div className="field"><label htmlFor="t-vendor">Vendor (optional)</label>
                    <select id="t-vendor" name="event_vendor_id" defaultValue=""><option value="">None</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.vendors?.name}</option>)}</select></div>
                )}
                <div className="field"><label htmlFor="t-notes">Notes (optional)</label><input id="t-notes" name="notes" maxLength={600} /></div>
                <button className="btn" type="submit">Add to timeline</button>
              </ActionForm>
              <p className="fine">Vendors linked to an item can see it on their booking.</p>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
