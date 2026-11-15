import Link from 'next/link';

// What's inside, as a lettered index. Each row links to where the feature lives.
const ROWS = [
  { title: 'A planner that listens', body: 'Reads every detail you give it and sizes the plan to your budget.', href: '/planner' },
  { title: 'One inbox', body: 'Every vendor conversation in one place, with unread counts.', href: '/inbox' },
  { title: 'Shortlist and vote', body: 'Co-hosts weigh in before anyone books.', href: '/tools/shortlist' },
  { title: 'Guest list & RSVPs', body: 'Guests answer from a link. No account needed.', href: '/tools/guests' },
  { title: 'Registry', body: 'Links to the things you actually want.', href: '/tools/registry' },
  { title: 'Day-of timeline', body: 'Who arrives when, so nobody has to ask.', href: '/tools/timeline' },
  { title: 'Your event website', body: 'One page for the date, the place and the RSVP.', href: '/tools/website' },
];

export default function Bento() {
  return (
    <section className="bento-sec" aria-labelledby="bento-title">
      <div className="wrap index-grid">
        <div className="stack-lg index-head" data-reveal>
          <p className="kicker" data-index="03">What’s inside</p>
          <h2 id="bento-title" className="display-1">Everything for the <em>big day</em>, in one place.</h2>
        </div>
        <ol className="index-list" role="list">
          {ROWS.map((r, i) => (
            <li key={r.title} data-reveal style={{ '--reveal-delay': `${i * 50}ms` }}>
              <Link href={r.href} className="index-row" data-cursor="Open">
                <span className="index-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                <span className="index-title">{r.title}</span>
                <span className="index-body">{r.body}</span>
                <span className="index-go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
