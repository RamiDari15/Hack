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

  const [{ data: event }, { data: bookings }, { data: plans }, { data: saved }, { data: sponsors }, { count: timelineCount }, { count: guestCount }, { count: giftCount }, { data: weather }] = await Promise.all([
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
  ]);
  if (!event) notFound();

  const plan = plans?.[0]?.output ?? null;
  const rows = bookings ?? [];
  const quotes = rows.flatMap((b) => (b.quotes ?? []).filter((q) => q.status !== 'declined' && q.status !== 'expired').map((q) => ({ ...q, vendor: b.vendors })));
  const committedCents = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + q.amount_cents, 0);
  const meta = [formatDate(event.event_date), event.location, event.guest_count ? `${event.guest_count} guests` : null].filter(Boolean).join(', ');

  return (
    <div className="page wrap">
      <PageHead back={{ href: '/dashboard', label: 'Your events' }} title={event.title} lede={meta}>
        <span className="badge badge-plain">{event.event_type}</span>
        {event.style && <span className="badge badge-plain">{event.style}</span>}
        <Link className="btn btn-sm btn-bulb" href={`/events/${event.id}/sponsors`}>Contact sponsors</Link>
      </PageHead>
      {sp?.created && <p className="notice notice-ok">Your event is saved. Get an AI plan or start finding vendors.</p>}

      <dl className="stat-strip">
        <div><dt>Budget</dt><dd className="num">{moneyCents(event.budget_cents)}</dd></div>
        <div><dt>Accepted quotes</dt><dd className="num">{moneyCents(committedCents)}</dd></div>
        <div><dt>Vendors contacted</dt><dd className="num">{rows.length}</dd></div>
        <div><dt>Quotes received</dt><dd className="num">{quotes.length}</dd></div>
      </dl>

      <PlanGuide event={event} plan={plan} bookings={rows} quotes={quotes} sponsors={sponsors ?? []} timelineCount={timelineCount ?? 0} guestCount={guestCount ?? 0} giftCount={giftCount ?? 0} />

      <div className="event-layout">
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="budget-h">
            <div className="panel-head">
              <h2 id="budget-h">Budget</h2>
              <Link className="btn btn-sm btn-outline" href={`/planner?event=${event.id}`}>{plan ? 'Rebuild AI plan' : 'Get an AI plan'}</Link>
            </div>
            {plan ? (
              <>
                <p className="muted small measure">{plan.summary}</p>
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
              <div className="empty"><h3>No vendors yet</h3><p className="muted small">Find someone you like and ask for a quote.</p></div>
            )}
          </section>

          <section className="panel stack" aria-labelledby="saved-h">
            <div className="panel-head">
              <h2 id="saved-h">Saved from the web</h2>
              <Link className="btn btn-sm btn-outline" href="/discover">Search the web</Link>
            </div>
            <p className="fine measure">Ideas from the web. Check details with each business.</p>
            {saved?.length ? (
              <ul role="list" className="booking-list">
                {saved.map((r) => (
                  <li key={r.id}>
                    <div className="stack-sm" style={{ flex: '1 1 320px' }}>
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
          <nav className="panel stack-sm event-tools" aria-label="Event tools">
            <h2 className="label">Event tools</h2>
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
            <div style={{ marginTop: 'var(--s-5)' }}>
              <EventForm compact action={updateEvent} eventId={event.id} submitLabel="Save changes" initial={{
                title: event.title, eventType: event.event_type, eventDate: event.event_date ?? '', location: event.location ?? '',
                guests: event.guest_count ?? '', budget: event.budget_cents == null ? '' : String(event.budget_cents / 100), style: event.style ?? '', notes: event.notes ?? '',
              }} />
            </div>
          </details>
          {event.notes && <div className="panel panel-quiet stack-sm"><h2 className="label">Notes</h2><p className="small" style={{ whiteSpace: 'pre-wrap' }}>{event.notes}</p></div>}
          <details className="panel disclosure">
            <summary>Delete event</summary>
            <form action={deleteEvent} className="stack" style={{ marginTop: 'var(--s-4)' }}>
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
