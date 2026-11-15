import Link from 'next/link';

// A small picture of each step, drawn with plain shapes. No figures, so nothing to invent.
function Art({ i }) {
  if (i === 0) return (
    <div className="step-art art-budget" aria-hidden="true">
      {[['Venue', 82], ['Food', 64], ['Music', 34], ['Flowers', 26]].map(([k, w]) => <div key={k} className="art-row"><span>{k}</span><i style={{ '--w': `${w}%` }} /></div>)}
    </div>
  );
  if (i === 1) return (
    <div className="step-art art-people" aria-hidden="true">
      {[['Florist', 'is-on'], ['DJ', ''], ['Baker', 'is-on']].map(([k, on]) => <div key={k} className={`art-person ${on}`}><b>{k[0]}</b><span>{k}</span><em>♥</em></div>)}
    </div>
  );
  return (
    <div className="step-art art-checks" aria-hidden="true">
      {['Guests replied', 'Registry shared', 'Timeline sent'].map((k) => <div key={k} className="art-check"><i>✓</i><span>{k}</span></div>)}
    </div>
  );
}

// Three cards that stack on top of each other as you scroll (position: sticky, no JS).
const STEPS = [
  { tone: 'sun', title: 'Tell it about the day', body: 'Type, date, place, guests, budget and what matters most. The planner splits the budget and writes the first to-dos.', href: '/planner', cta: 'Try the planner' },
  { tone: 'pink', title: 'Find your people', body: 'Search vendors by category and area. Shortlist favourites, let your co-hosts vote, and message them from one inbox.', href: '/vendors', cta: 'Browse vendors' },
  { tone: 'paper', title: 'Watch it come together', body: 'Quotes land in your budget as vendors reply. Guests RSVP, the registry fills up, and the timeline keeps everyone on time.', href: '/events/new', cta: 'Start an event' },
];

export default function Steps() {
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="wrap steps-grid">
        <div className="steps-head" data-reveal>
          <h2 id="steps-title" className="display-1">Three steps. <em>No</em> binders.</h2>
        </div>
        <ol className="steps-stack" role="list">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`step-card step-${s.tone}`} style={{ '--i': i }}>
              <div className="step-text">
                <h3 className="display-2">{s.title}</h3>
                <p className="lede">{s.body}</p>
                <Link href={s.href} className="btn btn-sm">{s.cta} <span className="arrow" aria-hidden="true">→</span></Link>
              </div>
              <Art i={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
