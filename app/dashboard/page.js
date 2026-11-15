import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import { formatDate, moneyCents } from '@/lib/format';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Your events' };

export default async function DashboardPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();

  if (!supabase) {
    return (
      <div className="page wrap-narrow">
        <PageHead title="Connect the database to start." />
        <p className="notice notice-warn">Supabase is not configured. Run npm run db:start, add the keys it prints to .env.local, then sign in to create events.</p>
      </div>
    );
  }

  if (!user) redirect('/sign-in?next=/dashboard');

  const [{ data: profile }, { data: events, error }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase.from('events').select('id, title, event_type, event_date, location, guest_count, budget_cents, event_vendors(count)').order('event_date', { ascending: true, nullsFirst: false }),
  ]);
  const name = profile?.display_name || user.email?.split('@')[0];
  const list = events ?? [];

  return (
    <div className="page wrap">
      <PageHead title={`Hello, ${name}.`} lede={list.length ? `You have ${list.length} ${list.length === 1 ? 'event' : 'events'} on the go.` : undefined}>
        <Link className="btn" href="/events/new">New event</Link>
        <Link className="btn btn-outline" href="/planner">Open the planner</Link>
      </PageHead>
      {sp?.deleted && <p className="notice" role="status">Event deleted.</p>}
      {error && <p className="notice notice-error" role="alert">Could not load your events. If you just created the project, check that the migrations in supabase/migrations have been applied.</p>}

      {!error && list.length === 0 && (
        <div className="empty">
          <h2>Nothing planned yet</h2>
          <p className="muted measure">Tell us the date, the place and roughly how many people. We’ll take it from there.</p>
          <Link className="btn" href="/events/new">Create your first event</Link>
        </div>
      )}

      {list.length > 0 && (
        <ol role="list" className="event-list">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="event-row">
                <span className="event-date">
                  {e.event_date ? (
                    <><b>{formatDate(e.event_date, { day: 'numeric' })}</b><span>{formatDate(e.event_date, { month: 'short', year: 'numeric' })}</span></>
                  ) : <span>Date not set</span>}
                </span>
                <span className="event-main">
                  <span className="title">{e.title}</span>
                  <span className="small muted">{e.event_type}{e.location ? `, ${e.location}` : ''}</span>
                </span>
                <span className="event-meta small num">
                  <span>{e.guest_count ? `${e.guest_count} guests` : 'Guests not set'}</span>
                  <span>Budget {moneyCents(e.budget_cents)}</span>
                  <span>{e.event_vendors?.[0]?.count ?? 0} vendors</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
