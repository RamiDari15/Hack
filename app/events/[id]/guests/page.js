import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, formatDate } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import CopyButton from '@/components/ui/CopyButton';
import { setGuestList, addGuests, removeGuest, applyRsvpHeadcount } from '@/app/actions/planning';

export const metadata = { title: 'Guest list' };

const RSVP = {
  invited: { label: 'No reply yet', tone: 'badge-plain' },
  yes: { label: 'Coming', tone: 'badge-ok' },
  maybe: { label: 'Maybe', tone: 'badge-warn' },
  no: { label: 'Not coming', tone: 'badge-plain' },
};

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

export default async function GuestsPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/guests`);

  const [{ data: event }, { data: guests }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, event_type, event_date, location, guest_count, guest_list_enabled, meal_options, website_enabled, website_slug').eq('id', id).maybeSingle(),
    supabase.from('event_guests').select('*').eq('event_id', id).order('created_at'),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const list = guests ?? [];
  const origin = await siteOrigin();
  const hidden = <><input type="hidden" name="event_id" value={event.id} /></>;

  const coming = list.filter((g) => g.status === 'yes').reduce((n, g) => n + (g.attending ?? 0), 0);
  const maybe = list.filter((g) => g.status === 'maybe').reduce((n, g) => n + (g.attending ?? 0), 0);
  const pending = list.filter((g) => g.status === 'invited').reduce((n, g) => n + g.party_size, 0);
  const expected = coming + maybe + pending;
  const meals = {};
  for (const g of list) if (g.status === 'yes' && g.meal) meals[g.meal] = (meals[g.meal] ?? 0) + (g.attending ?? 0);

  if (!event.guest_list_enabled) {
    return (
      <div className="page wrap">
        <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Guest list" size="display-2"
          lede="Optional. Turn it on to collect RSVPs and meal choices through a private link for each guest." />
        <section className="panel stack measure">
          <p className="small">Guests reply without an account. Their answers give you a real headcount, which you can send to the planner and to per-person prices like catering.</p>
          {list.length > 0 && <p className="fine">You have {list.length} guests saved. Their links work again when you turn the list back on.</p>}
          {isOwner ? (
            <ActionForm action={setGuestList}>
              {hidden}<input type="hidden" name="enabled" value="yes" />
              <div className="row"><button className="btn" type="submit">Turn on guest list</button></div>
            </ActionForm>
          ) : <p className="notice">Only the event owner can turn on the guest list.</p>}
        </section>
      </div>
    );
  }

  const inviteText = (g) => `Hi ${g.name},\n\nYou're invited to ${event.title}${event.event_date ? ` on ${formatDate(event.event_date)}` : ''}${event.location ? ` in ${event.location}` : ''}.\n\nPlease let us know if you can come: ${origin}/rsvp/${g.rsvp_token}\n`;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Guest list" size="display-2"
        lede="Each guest gets a private RSVP link. Share it yourself; Vendora does not email guests." />
      <p><a className="btn btn-sm btn-outline" href={`/api/events/${id}/export?type=guests`} download>Export CSV</a></p>

      <dl className="stat-strip">
        <div><dt>Coming</dt><dd className="num">{coming}</dd></div>
        <div><dt>Maybe</dt><dd className="num">{maybe}</dd></div>
        <div><dt>No reply yet</dt><dd className="num">{pending}</dd></div>
        <div><dt>Expected</dt><dd className="num">{expected}</dd></div>
      </dl>

      <div className="event-layout">
        <div className="stack-lg">
          {isOwner && expected > 0 && expected !== event.guest_count && (
            <ActionForm action={applyRsvpHeadcount} className="panel panel-quiet stack-sm">
              {hidden}
              <p className="small">Your event says <b className="num">{event.guest_count ?? 'no'}</b> guests. RSVPs point to <b className="num">{expected}</b> (coming, maybe and not yet replied).</p>
              <div className="row"><button className="btn btn-sm" type="submit">Use {expected} as the guest count</button></div>
            </ActionForm>
          )}
          {Object.keys(meals).length > 0 && (
            <section className="panel stack-sm" aria-labelledby="meals-h">
              <h2 id="meals-h" className="title">Meal choices so far</h2>
              <ul role="list" className="row">{Object.entries(meals).map(([m, n]) => <li key={m} className="badge badge-plain num">{m}: {n}</li>)}</ul>
              <p className="fine">Share these counts with your caterer.</p>
            </section>
          )}

          <section className="panel stack" aria-labelledby="list-h">
            <div className="panel-head"><h2 id="list-h">Guests ({list.length})</h2></div>
            {list.length ? (
              <ul role="list" className="booking-list">
                {list.map((g) => {
                  const st = RSVP[g.status] ?? RSVP.invited;
                  const link = `${origin}/rsvp/${g.rsvp_token}`;
                  return (
                    <li key={g.id} className="guest-row">
                      <div className="stack-sm" style={{ flex: '1 1 260px' }}>
                        <p className="title">{g.name} <span className="fine">party of {g.party_size}</span></p>
                        <p className="fine">
                          {g.status === 'yes' || g.status === 'maybe' ? `${g.attending} attending` : null}
                          {g.meal ? `, ${g.meal}` : ''}{g.dietary ? `. Dietary: ${g.dietary}` : ''}
                          {g.email && <span> {g.email}</span>}
                        </p>
                      </div>
                      <div className="row">
                        <span className={`badge ${st.tone}`}>{st.label}</span>
                        {isOwner && <CopyButton text={link} label="Copy RSVP link" />}
                        {isOwner && event.website_enabled && event.website_slug && <CopyButton text={`${origin}/e/${event.website_slug}?g=${g.rsvp_token}`} label="Copy website link" />}
                        {isOwner && g.email && <a className="btn btn-sm btn-outline" href={`mailto:${g.email}?subject=${encodeURIComponent(`RSVP: ${event.title}`)}&body=${encodeURIComponent(inviteText(g))}`}>Email invite</a>}
                        {isOwner && <form action={removeGuest}>{hidden}<input type="hidden" name="id" value={g.id} /><button className="btn btn-sm btn-outline" type="submit">Remove</button></form>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="empty"><h3>No guests yet</h3><p className="muted small">Paste your list on the right, one guest per line.</p></div>}
          </section>
        </div>

        {isOwner && (
          <aside className="stack-lg">
            <section className="panel stack" aria-labelledby="add-g">
              <h2 id="add-g" className="title">Add guests</h2>
              <ActionForm action={addGuests} resetOnOk>
                {hidden}
                <div className="field"><label htmlFor="guests">One per line: name, email (optional), party size (optional)</label>
                  <textarea id="guests" name="guests" rows={6} placeholder={'Ana Ruiz, ana@example.com, 2\nSam Lee'} /></div>
                <button className="btn" type="submit">Add to list</button>
              </ActionForm>
            </section>
            <section className="panel stack" aria-labelledby="set-g">
              <h2 id="set-g" className="title">Settings</h2>
              <ActionForm action={setGuestList}>
                {hidden}<input type="hidden" name="enabled" value="yes" />
                <div className="field"><label htmlFor="meal_options">Meal options guests can pick (one per line, up to 8)</label>
                  <textarea id="meal_options" name="meal_options" rows={4} defaultValue={(event.meal_options ?? []).join('\n')} placeholder={'Chicken\nFish\nVegetarian'} /></div>
                <button className="btn btn-sm btn-outline" type="submit">Save meal options</button>
              </ActionForm>
              <ActionForm action={setGuestList}>
                {hidden}<input type="hidden" name="enabled" value="no" />
                <button className="btn btn-sm btn-outline" type="submit">Turn off guest list</button>
              </ActionForm>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
