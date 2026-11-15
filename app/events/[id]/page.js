import DuplicateEvent from '@/components/DuplicateEvent';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, BOOKING_STATUS, formatDate, money, moneyCents } from '@/lib/format';
import EventForm from '@/components/EventForm';
import BudgetTable from '@/components/BudgetTable';
import PageHead from '@/components/PageHead';
import PlanGuide from '@/components/PlanGuide';
import WeatherRisk from '@/components/WeatherRisk';
import { updateEvent, deleteEvent, removeExternalResult } from '../actions';

export const metadata = { title: 'Event' };

export default async function EventPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}`);

  const [{ data: event }, { data: bookings }, { data: plans }, { data: saved }, { data: sponsors }, { count: timelineCount }, { count: guestCount }, { count: giftCount }, { data: weather }, {data:shortlist}, {data:eventIdeas}] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase.from('event_vendors')
      .select('id, status, hold_expires_at, created_at, vendors(id, name, category, city), quotes(id, amount_cents, description, valid_until, status, created_at)')
      .eq('event_id', id).order('created_at'),
    supabase.from('ai_requests').select('id, output, created_at').eq('event_id', id).eq('kind', 'plan')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('event_saved_results').select('id, title, url, host, snippet, created_at').eq('event_id', id).order('created_at', { ascending: false }),
    supabase.from('sponsor_leads').select('id, status').eq('event_id', id),
    supabase.from('event_timeline_items').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('event_guests').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('event_registry_items').select('id', { count: 'exact', head: true }).eq('event_id', id),
    supabase.from('event_weather').select('*').eq('event_id', id).maybeSingle(),
    supabase.from('event_shortlist').select('id,vendor_id,in_package,planned_cents,pricing_selection,vendors(name,category,city,calendar_is_demo,directory_listed)').eq('event_id',id).order('in_package',{ascending:false}),
    supabase.from('event_ideas').select('idea_key,title,note').eq('event_id',id),
  ]);
  if (!event) notFound();

  const plan = plans?.[0]?.output ?? event.starter_plan ?? null;
  const rows = bookings ?? [];
  const walkthrough = (shortlist ?? []).filter(s => s.vendors?.calendar_is_demo && !s.vendors?.directory_listed);
  const quotes = rows.flatMap((b) => (b.quotes ?? []).filter((q) => q.status !== 'declined' && q.status !== 'expired').map((q) => ({ ...q, vendor: b.vendors })));
  const committedCents = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + q.amount_cents, 0);
  const plannedCents=(shortlist||[]).filter(v=>v.in_package).reduce((n,v)=>n+(v.planned_cents||0),0);
  const meta = [formatDate(event.event_date), event.location, event.guest_count ? `${event.guest_count} guests` : null].filter(Boolean).join(', ');

  return (
    <div className="page wrap ev">
      <PageHead back={{ href: '/dashboard', label: 'Your events' }} title={event.title} lede={[meta, event.event_type, event.style].filter(Boolean).join(' · ')}>
        <Link className="btn btn-sm" href={`/vendors?event=${id}&location=${encodeURIComponent((event.location||'').split(',')[0])}`}>＋ Add vendors</Link>
        <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/sponsors`}>Contact sponsors</Link>
        <a className="btn btn-sm btn-outline" href={`/api/events/${id}/export?type=budget`} download>Export budget CSV</a>
        {event.owner_id===user.id&&<DuplicateEvent eventId={id}/>}
      </PageHead>
      {sp?.created && <p className="notice notice-ok">Your event is saved. Get an AI plan or start finding vendors.</p>}

      <dl className="stat-strip">
        <div><dt>Budget</dt><dd className="num">{moneyCents(event.budget_cents)}</dd></div>
        <div><dt>Accepted quotes</dt><dd className="num">{moneyCents(committedCents)}</dd></div>
        <div><dt>Shortlisted vendors</dt><dd className="num">{shortlist?.length||0}</dd></div>
        <div><dt>Planned vendor costs</dt><dd className="num">{moneyCents(plannedCents)}</dd></div>
      </dl>

      <Link className="walk-entry" href={`/events/${id}/walk`}>
        <span><b>Walk through your event</b><span>Step around a 3D room with one stop per vendor you need. Add or remove vendors as you go.</span></span>
        <i>Open the walk</i>
      </Link>
      {walkthrough.length > 0 && <section className="panel stack" aria-labelledby="walkthrough-vendors">
        <h2 id="walkthrough-vendors">Connected sample vendors</h2>
        <p className="fine">These private businesses are managed by your vendor walkthrough account. Send a request here, then switch to the vendor window to reply with a quote.</p>
        <ul role="list" className="booking-list">{walkthrough.map(s => {
          const booking = rows.find(b => b.vendors?.id === s.vendor_id);
          return <li key={s.id}><div><Link className="title" href={`/vendors/${s.vendor_id}?event=${id}`}>{s.vendors.name}</Link><p className="fine">{s.vendors.category}</p></div>
            <Link className="btn btn-sm btn-outline" href={booking ? `/bookings/${booking.id}` : `/vendors/${s.vendor_id}?event=${id}#request-quote`}>{booking ? 'Open conversation' : 'Request a quote'}</Link></li>;
        })}</ul>
      </section>}
      <PlanGuide event={event} plan={plan} bookings={rows} quotes={quotes} sponsors={sponsors ?? []} timelineCount={timelineCount ?? 0} guestCount={guestCount ?? 0} giftCount={giftCount ?? 0} shortlistCount={shortlist?.length||0} />

      <div className="event-layout">
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="budget-h">
            <div className="panel-head">
              <h2 id="budget-h">Budget</h2>
              <Link className="btn btn-sm btn-outline" href={`/planner?event=${event.id}`}>{plan ? 'Rebuild AI plan' : 'Get an AI plan'}</Link>
            </div>
            {plan ? (
              <>
                <p className="muted small measure">{plan.summary} {plans?.[0]?.id && <Link href={`/plans/${plans[0].id}`}>Open the full plan</Link>}</p>
                <BudgetTable categories={plan.categories ?? []} quotes={quotes} />
                
              </>
            ) : (
              <div className="empty"><h3>No plan yet</h3><p className="muted small">Get a budget split for this event, with the sneaky costs like tips, delivery and setup included.</p></div>
            )}
          </section>

          <section className="panel stack" aria-labelledby="vendors-h">
            <div className="panel-head">
              <h2 id="vendors-h">Vendors</h2>
              <Link className="btn btn-sm" href={`/events/${event.id}/choose`}>Choose vendors step by step</Link>
            </div>
            {rows.length ? (
              <ul role="list" className="booking-list">
                {rows.map((b) => {
                  const s = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry;
                  return (
                    <li key={b.id}>
                      <div>
                        <Link href={`/vendors/${b.vendors?.id}`} className="title">{b.vendors?.name ?? 'Vendor'}</Link>
                        <p className="fine">{b.vendors?.category}{b.vendors?.city ? `, ${b.vendors.city}` : ''}</p>
                      </div>
                      <div className="row">
                        {(b.quotes ?? []).map((q) => <span key={q.id} className="badge badge-plain num">Quote {moneyCents(q.amount_cents)}</span>)}
                        <span className={`badge ${s.tone}`}>{s.label}</span>
                        <Link className="btn btn-sm btn-outline" href={`/bookings/${b.id}`}>Open</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              shortlist?.length?<div className="stack"><ul role="list" className="booking-list">{shortlist.slice(0,8).map(v=><li key={v.id}><div><Link className="title" href={`/vendors/${v.vendor_id}?event=${id}`}>{v.vendors?.name}</Link><p className="fine">{v.vendors?.category} · {v.vendors?.city}</p></div><div className="stack-sm"><span className="badge">{v.in_package?'In your package':'Considering'}</span>{v.planned_cents!=null&&<span className="fine num">{moneyCents(v.planned_cents)} planned</span>}</div></li>)}</ul><div className="row"><Link className="btn btn-sm" href={`/events/${id}/shortlist`}>Open full shortlist</Link><Link className="btn btn-sm btn-outline" href={`/events/${id}/package`}>See package costs</Link></div></div>:<div className="empty"><h3>Find your first vendor</h3><p className="muted small">Save businesses to this event before you contact them.</p><Link className="btn btn-sm" href={`/vendors?event=${id}`}>Browse vendors for this event</Link></div>
            )}
          </section>

          <section className="panel stack" aria-labelledby="saved-h">
            <div className="panel-head">
              <h2 id="saved-h">Ideas & inspiration</h2>
              <Link className="btn btn-sm btn-outline" href="/ideas">Explore ideas</Link>
            </div>
            <p className="fine measure">Ideas from the web. Check details with each business.</p>
            {!!eventIdeas?.length&&<ul role="list" className="booking-list">{eventIdeas.map(i=><li key={i.idea_key}><div><Link className="title" href={`/events/${id}/ideas`}>{i.title}</Link><p className="fine">{i.note}</p></div><Link className="btn btn-sm btn-outline" href={`/events/${id}/board`}>Style board</Link></li>)}</ul>}
            {saved?.length ? (
              <ul role="list" className="booking-list">
                {saved.map((r) => (
                  <li key={r.id}>
                    <div className="stack-sm ev-grow">
                      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="title">{r.title}<span className="sr-only"> (opens in a new tab)</span></a>
                      <p className="fine">{r.host}</p>
                      {r.snippet && <p className="small muted">{r.snippet}</p>}
                    </div>
                    <div className="row">
                      <span className="badge badge-warn">External, confirm</span>
                      <form action={removeExternalResult}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="event_id" value={event.id} /><button className="btn btn-sm btn-outline" type="submit">Remove</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty"><h3>Nothing saved yet</h3><p className="muted small">Save venues and ideas from web search to keep them here.</p></div>
            )}
          </section>

        </div>

        <aside className="stack-lg">
          <WeatherRisk event={event} weather={weather} isOwner={event.owner_id === user.id} />
          <nav className="panel event-tools" aria-label="Event tools">
            <h2 className="ev-panel-title">Event tools</h2>
            <Link href={`/events/${event.id}/shortlist`}>Shortlist and compare <span className="fine">vote together</span></Link>
            <Link href={`/events/${event.id}/package`}>Package and trade-offs <span className="fine">total vs. budget</span></Link>
            <Link href={`/events/${event.id}/website`}>Event website <span className="fine">{event.website_enabled ? 'Live' : 'Not published'}</span></Link>
            <Link href={`/events/${event.id}/seating`}>Seating chart <span className="fine">{event.guest_list_enabled ? 'from RSVPs' : 'needs the guest list'}</span></Link>
            <Link href={`/events/${event.id}/board`}>Style board <span className="fine">venue, flowers, decor, outfits</span></Link>
            <Link href={`/events/${event.id}/tasks`}>Shared checklist <span className="fine">tasks and owners</span></Link>
            <Link href={`/events/${event.id}/team`}>Planning team <span className="fine">invite people</span></Link>
            <Link href={`/events/${event.id}/quotes`}>Compare quotes <span className="fine">{quotes.length} received</span></Link>
            <Link href={`/events/${event.id}/timeline`}>Day-of timeline <span className="fine">{timelineCount ? `${timelineCount} items` : 'Not started'}</span></Link>
            <Link href={`/events/${event.id}/guests`}>Guest list and RSVPs <span className="fine">{event.guest_list_enabled ? `${guestCount ?? 0} guests` : 'Optional, off'}</span></Link>
            <Link href={`/events/${event.id}/registry`}>Registry <span className="fine">{event.registry_enabled ? `${giftCount ?? 0} gifts` : 'Optional, off'}</span></Link>
            <Link href={`/events/${event.id}/sponsors`}>Sponsors <span className="fine">{(sponsors ?? []).length} on your list</span></Link>
          </nav>
          <details className="panel disclosure" id="edit-details" open={sp?.edit === '1' || undefined}>
            <summary>Edit details</summary>
            <div className="disclosure-body">
              <EventForm compact action={updateEvent} eventId={event.id} submitLabel="Save changes" initial={{
                title: event.title, eventType: event.event_type, eventDate: event.event_date ?? '', location: event.location ?? '',
                guests: event.guest_count ?? '', budget: event.budget_cents == null ? '' : String(event.budget_cents / 100), style: event.style ?? '', notes: event.notes ?? '',
              }} />
            </div>
          </details>
          {event.notes && <div className="panel panel-quiet stack-sm"><h2 className="ev-panel-title">Notes</h2><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</p></div>}
          <details className="panel disclosure">
            <summary>Delete event</summary>
            <form action={deleteEvent} className="stack disclosure-body">
              <input type="hidden" name="id" value={event.id} />
              <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /> <span>I understand this deletes the event, its vendor inquiries and its AI plan.</span></label>
              {sp?.error === 'confirm' && <p className="notice notice-error" role="alert">Tick the box to confirm.</p>}
              <button className="btn btn-outline btn-sm" type="submit">Delete permanently</button>
            </form>
          </details>
          <p className="fine">Budget {event.budget_cents == null ? 'not set' : money(event.budget_cents / 100)}. Created {formatDate(event.created_at?.slice(0, 10))}.</p>
        </aside>
      </div>
    </div>
  );
}
