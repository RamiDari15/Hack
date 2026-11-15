import Link from 'next/link';
import {formatDate} from '@/lib/format';
const hhmm = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export default function EventWebsiteView({site,guestToken=null,preview=false}){
 const when=formatDate(site.event_date);
  return (
    <div className="event-site">
      {preview&&<div className="wrap notice notice-sun">Private preview · Only people on this event can see this page. Publish from your website settings when you are ready.</div>}
      <header className="event-site-hero on-dusk">
        <div className="wrap stack">
          <p className="label">{site.event_type}</p>
          <h1 className="display-1">{site.title}</h1>
          <p className="lede">{[when, site.location].filter(Boolean).join(' · ')}</p>
          {site.rsvp_open && (guestToken
            ? <div className="row"><Link className="btn btn-bulb" href={`/rsvp/${guestToken}`}>Reply to your invitation</Link></div>
            : <p className="small">To RSVP, use the personal link in your invitation.</p>)}
        </div>
      </header>
      <div className="wrap event-site-body stack-lg">
        {site.intro && <section className="measure"><p className="lede" style={{ whiteSpace: 'pre-wrap' }}>{site.intro}</p></section>}
        {site.schedule.length > 0 && (
          <section className="stack" aria-labelledby="es-sched">
            <h2 id="es-sched" className="display-3">Schedule</h2>
            <ol role="list" className="timeline">
              {site.schedule.map((t, i) => (
                <li key={i}><p className="timeline-time num">{hhmm(t.start)}{t.end ? <span className="fine"> to {hhmm(t.end)}</span> : null}</p><p className="title">{t.title}</p><span /></li>
              ))}
            </ol>
          </section>
        )}
        {site.location && (
          <section className="stack-sm" aria-labelledby="es-where">
            <h2 id="es-where" className="display-3">Where</h2>
            <p>{site.location}</p>
            <a className="btn btn-sm btn-outline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.location)}`} target="_blank" rel="noopener noreferrer">Open in Google Maps<span className="sr-only"> (opens in a new tab)</span></a>
          </section>
        )}
        {site.registry_open && site.registry.length > 0 && (
          <section className="stack" aria-labelledby="es-reg">
            <h2 id="es-reg" className="display-3">Registry</h2>
            <p className="small muted">{guestToken ? <>Claim a gift from <Link href={`/rsvp/${guestToken}`}>your RSVP page</Link> so nobody doubles up.</> : 'Claim a gift from the RSVP link in your invitation so nobody doubles up.'}</p>
            <ul role="list" className="booking-list">
              {site.registry.map((r, i) => (
                <li key={i}>
                  <div><p className="title">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">{r.title}<span className="sr-only"> (opens in a new tab)</span></a> : r.title}</p>{r.price_note && <p className="fine">{r.price_note}</p>}</div>
                  <span className={`badge ${r.remaining ? 'badge-plain' : 'badge-ok'}`}>{r.remaining ? `${r.remaining} of ${r.quantity} open` : 'Claimed'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="fine">Made with Vendora.</p>
      </div>
    </div>
  );
}
