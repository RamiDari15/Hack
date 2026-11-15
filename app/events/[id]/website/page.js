import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import CopyButton from '@/components/ui/CopyButton';
import { setWebsite, toggleScheduleItem } from '@/app/actions/planning';

export const metadata = { title: 'Event website' };

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

export default async function WebsiteSettingsPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/website`);
  const [{ data: event }, { data: items }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, website_enabled, website_slug, website_intro, guest_list_enabled, registry_enabled').eq('id', id).maybeSingle(),
    supabase.from('event_timeline_items').select('id, start_time, title, show_on_website, event_vendor_id').eq('event_id', id).order('start_time'),
  ]);
  if (!event) notFound();
  if (event.owner_id !== user.id) redirect(`/events/${id}`);
  const origin = await siteOrigin();
  const url = event.website_slug ? `${origin}/e/${event.website_slug}` : null;
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Event website" size="display-2"
        lede="One page for guests: the date, place, schedule and registry. Guests reply with the personal RSVP link from their invitation." />
      <div className="event-layout">
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="ws-h">
            <div className="panel-head"><h2 id="ws-h">Publishing</h2><span className={`badge ${event.website_enabled ? 'badge-ok' : 'badge-plain'}`}>{event.website_enabled ? 'Live' : 'Offline'}</span></div>
            {event.website_enabled && url && (
              <div className="row"><a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer">Open the website<span className="sr-only"> (opens in a new tab)</span></a><CopyButton text={url} label="Copy website link" /></div>
            )}
            <ActionForm action={setWebsite}>
              {hidden}
              <div className="field"><label htmlFor="ws-intro">Welcome message</label>
                <textarea id="ws-intro" name="intro" rows={5} maxLength={2000} defaultValue={event.website_intro ?? ''} placeholder="We can’t wait to celebrate with you." /></div>
              <input type="hidden" name="enabled" value={event.website_enabled ? 'yes' : 'yes'} />
              <div className="row"><button className="btn" type="submit">{event.website_enabled ? 'Save' : 'Publish website'}</button></div>
            </ActionForm>
            {event.website_enabled && (
              <ActionForm action={setWebsite}>{hidden}<input type="hidden" name="enabled" value="no" /><button className="btn btn-sm btn-outline" type="submit">Take the website offline</button></ActionForm>
            )}
            <p className="fine">The website never shows guest names, vendors, budgets or private notes. Anyone with the link can see it.</p>
          </section>
          <section className="panel stack" aria-labelledby="sch-h">
            <h2 id="sch-h">Schedule on the website</h2>
            {items?.length ? (
              <ul role="list" className="booking-list">
                {items.map((t) => (
                  <li key={t.id}>
                    <p className="small"><b className="num">{t.start_time.slice(0, 5)}</b> {t.title}{t.event_vendor_id ? <span className="fine"> (vendor item)</span> : null}</p>
                    <form action={toggleScheduleItem}>{hidden}<input type="hidden" name="id" value={t.id} /><input type="hidden" name="show" value={t.show_on_website ? 'no' : 'yes'} />
                      <button className={`btn btn-sm ${t.show_on_website ? '' : 'btn-outline'}`} type="submit" aria-pressed={t.show_on_website}>{t.show_on_website ? 'Shown' : 'Hidden'}</button></form>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">Add items on the <Link href={`/events/${event.id}/timeline`}>day-of timeline</Link>, then choose which guests should see.</p>}
          </section>
        </div>
        <aside className="stack-lg">
          <div className="panel panel-quiet stack-sm">
            <p className="label">On the page</p>
            <ul className="small">
              <li>Date and location</li>
              <li>Schedule items you mark Shown</li>
              <li>RSVP: {event.guest_list_enabled ? 'guests reply with their personal link' : <><Link href={`/events/${event.id}/guests`}>turn on the guest list</Link> to collect RSVPs</>}</li>
              <li>Registry: {event.registry_enabled ? 'shown, claims through each guest’s RSVP link' : <Link href={`/events/${event.id}/registry`}>off</Link>}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
