import Link from 'next/link';

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
              <h3 className="display-2">{s.title}</h3>
              <p className="lede">{s.body}</p>
              <Link href={s.href} className="btn btn-sm">{s.cta} <span className="arrow" aria-hidden="true">→</span></Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
