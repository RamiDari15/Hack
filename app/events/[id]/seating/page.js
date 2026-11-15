import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { addTables, removeTable, seatGuest, autoSeat } from '@/app/actions/planning';

export const metadata = { title: 'Seating chart' };

const seatsFor = (g) => (g.status === 'no' ? 0 : g.status === 'invited' ? g.party_size : (g.attending ?? 0));
const STATUS = { yes: 'Coming', maybe: 'Maybe', invited: 'No reply yet' };

export default async function SeatingPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/seating`);
  const [{ data: event }, { data: tables }, { data: guests }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, guest_list_enabled').eq('id', id).maybeSingle(),
    supabase.from('event_tables').select('id, name, seats').eq('event_id', id).order('created_at'),
    supabase.from('event_guests').select('id, name, status, party_size, attending, meal, dietary, table_id').eq('event_id', id).order('name'),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const seated = (guests ?? []).filter((g) => seatsFor(g) > 0);
  const unseated = seated.filter((g) => !g.table_id);
  const at = (tid) => seated.filter((g) => g.table_id === tid);
  const hidden = <input type="hidden" name="event_id" value={event.id} />;
  const totalSeats = (tables ?? []).reduce((n, t) => n + t.seats, 0);
  const people = seated.reduce((n, g) => n + seatsFor(g), 0);

  const seatForm = (g) => isOwner && (
    <form action={seatGuest} className="row seat-form">
      {hidden}<input type="hidden" name="guest_id" value={g.id} />
      <label className="sr-only" htmlFor={`st-${g.id}`}>Table for {g.name}</label>
      <select id={`st-${g.id}`} name="table_id" defaultValue={g.table_id ?? ''}>
        <option value="">Not seated</option>
        {(tables ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button className="btn btn-sm btn-outline" type="submit">Move</button>
    </form>
  );

  if (!event.guest_list_enabled && !(guests ?? []).length) {
    return (
      <div className="page wrap ev">
        <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Seating chart" size="display-2" lede="Seat guests who RSVP at tables." />
        <div className="panel empty"><h3>Start with the guest list</h3><p className="muted small">The seating chart uses your guests and their RSVPs.</p><Link className="btn btn-sm" href={`/events/${event.id}/guests`}>Set up the guest list</Link></div>
      </div>
    );
  }

  return (
    <div className="page wrap ev">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Seating chart" size="display-2"
        lede={`${people} people to seat, ${totalSeats} seats at ${(tables ?? []).length} tables. Guests who said no are left out; parties that haven’t replied count at full size.`} />
      {totalSeats > 0 && people > totalSeats && <p className="notice notice-warn">You need {people - totalSeats} more seats.</p>}

      <div className="event-layout">
        <section aria-label="Tables" className="stack-lg">
          {(tables ?? []).length ? (
            <ul role="list" className="seating-grid">
              {tables.map((t) => {
                const list = at(t.id);
                const used = list.reduce((n, g) => n + seatsFor(g), 0);
                return (
                  <li key={t.id} className={`panel stack-sm seat-table${used > t.seats ? ' is-over' : ''}`}>
                    <div className="between"><h2 className="title">{t.name}</h2><span className={`badge ${used > t.seats ? 'badge-warn' : used === t.seats ? 'badge-ok' : 'badge-plain'} num`}>{used} / {t.seats}</span></div>
                    <div className="seat-dots" aria-hidden="true">{Array.from({ length: t.seats }, (_, i) => <span key={i} className={i < used ? 'on' : undefined} />)}</div>
                    <ul role="list" className="stack-sm">
                      {list.map((g) => (
                        <li key={g.id} className="small seat-guest">
                          <span><b>{g.name}</b> <span className="fine">{seatsFor(g)} {seatsFor(g) === 1 ? 'seat' : 'seats'}{g.meal ? `, ${g.meal}` : ''}{g.dietary ? `, ${g.dietary}` : ''}</span></span>
                          {seatForm(g)}
                        </li>
                      ))}
                      {!list.length && <li className="fine">Empty</li>}
                    </ul>
                    {isOwner && <form action={removeTable}>{hidden}<input type="hidden" name="id" value={t.id} /><button className="as-link fine" type="submit">Remove table</button></form>}
                  </li>
                );
              })}
            </ul>
          ) : <div className="panel empty"><h3>No tables yet</h3><p className="muted small">Add tables on the right, then seat guests or let Vendora arrange them.</p></div>}
        </section>
        <aside className="stack-lg">
          {isOwner && (
            <section className="panel stack" aria-labelledby="tb-h">
              <h2 id="tb-h" className="title">Add tables</h2>
              <ActionForm action={addTables}>
                {hidden}
                <div className="field-pair">
                  <div className="field"><label htmlFor="tb-count">How many</label><input id="tb-count" name="count" inputMode="numeric" defaultValue="1" /></div>
                  <div className="field"><label htmlFor="tb-seats">Seats each</label><input id="tb-seats" name="seats" inputMode="numeric" defaultValue="8" /></div>
                </div>
                <div className="field"><label htmlFor="tb-name">Name (optional)</label><input id="tb-name" name="name" maxLength={40} placeholder="Table" /></div>
                <button className="btn" type="submit">Add</button>
              </ActionForm>
            </section>
          )}
          <section className="panel stack" aria-labelledby="un-h">
            <div className="panel-head"><h2 id="un-h" className="title">Not seated ({unseated.length})</h2></div>
            {isOwner && unseated.length > 0 && (tables ?? []).length > 0 && (
              <ActionForm action={autoSeat}>{hidden}<button className="btn btn-sm" type="submit">Arrange automatically</button></ActionForm>
            )}
            <ul role="list" className="stack-sm">
              {unseated.map((g) => (
                <li key={g.id} className="small seat-guest">
                  <span><b>{g.name}</b> <span className="fine">{seatsFor(g)} · {STATUS[g.status]}</span></span>
                  {seatForm(g)}
                </li>
              ))}
              {!unseated.length && <li className="fine">Everyone is seated.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
