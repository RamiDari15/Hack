import Link from 'next/link';
import { EVENT_TYPES } from '@/lib/categories';
import RotatingWord from './RotatingWord';

// The closing ask: one line with a cycling word, then a deck of event "tickets" that each open
// a new event with that type filled in.
const ROTATE = ['wedding', 'birthday', 'graduation', 'baby shower', 'quinceañera', 'gala', 'block party'];
const TICKETS = [
  ['Wedding', 'sun'], ['Birthday', 'pink'], ['Graduation', 'paper'], ['Baby shower', 'pink'],
  ['Corporate event', 'ink'], ['Fundraiser or gala', 'sun'], ['Quinceañera', 'paper'], ['Dinner party', 'pink'],
  ['Engagement party', 'paper'], ['Block party', 'sun'], ['Reunion', 'ink'], ['Holiday party', 'paper'],
].filter(([t]) => EVENT_TYPES.includes(t));

export default function Close() {
  return (
    <section className="close" aria-labelledby="close-title">
      <div className="wrap close-inner">
        <div className="close-head" data-reveal>
          <p className="kicker">Your turn</p>
          <h2 id="close-title" className="display-1 close-title">
            Let’s plan your <RotatingWord words={ROTATE} />
          </h2>
          <p className="lede">Pick one to start. You can change anything later.</p>
        </div>
        <ul className="tickets" role="list">
          {TICKETS.map(([t, tone], i) => (
            <li key={t} data-reveal style={{ '--reveal-delay': `${(i % 6) * 50}ms`, '--tilt': `${((i * 37) % 7) - 3}deg` }}>
              <Link className={`ticket ticket-${tone}`} href={`/events/new?type=${encodeURIComponent(t)}`} data-cursor="Plan it">
                <span className="ticket-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="ticket-name">{t}</span>
                <span className="ticket-go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="close-foot" data-reveal>
          <Link href="/events/new" className="btn btn-lg btn-bulb">Something else? Start here <span className="arrow" aria-hidden="true">→</span></Link>
          <span className="small muted">40 event types to choose from.</span>
        </div>
      </div>
    </section>
  );
}
