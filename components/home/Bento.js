import Link from 'next/link';

// What's inside, as a tiled grid. Each tile links to where the feature lives.
const TILES = [
  { size: 'xl', tone: 'sun', title: 'A planner that listens', body: 'It reads every detail you give it: setting, hours, style, priorities and budget, and sizes the plan to fit.', href: '/planner', art: 'chart' },
  { size: 'md', tone: 'pink', title: 'One inbox', body: 'Every vendor conversation in one place, with unread counts.', href: '/inbox', art: 'chat' },
  { size: 'md', tone: 'paper', title: 'Shortlist and vote', body: 'Co-hosts weigh in before anyone books.', href: '/tools/shortlist', art: 'heart' },
  { size: 'sm', tone: 'ink', title: 'Guest list & RSVPs', href: '/tools/guests', art: 'people' },
  { size: 'sm', tone: 'paper', title: 'Registry', href: '/tools/registry', art: 'gift' },
  { size: 'sm', tone: 'pink', title: 'Day-of timeline', href: '/tools/timeline', art: 'clock' },
  { size: 'sm', tone: 'sun', title: 'Your event website', href: '/tools/website', art: 'globe' },
];

const ART = {
  chart: <><rect x="8" y="40" width="12" height="24" rx="4" /><rect x="26" y="26" width="12" height="38" rx="4" /><rect x="44" y="14" width="12" height="50" rx="4" /></>,
  chat: <><path d="M8 14h44a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H26l-12 10V48H14a6 6 0 0 1-6-6z" /></>,
  heart: <path d="M32 58S8 44 8 26a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 18-24 32-24 32z" />,
  people: <><circle cx="22" cy="22" r="9" /><circle cx="44" cy="24" r="7" /><path d="M6 56c0-10 7-17 16-17s16 7 16 17zM34 56c1-9 5-14 11-14s11 5 11 14z" /></>,
  gift: <><rect x="10" y="24" width="44" height="32" rx="5" /><rect x="6" y="16" width="52" height="12" rx="4" /><path d="M32 16v40" stroke="var(--ink)" strokeWidth="3" /></>,
  clock: <><circle cx="32" cy="34" r="24" /><path d="M32 20v15l10 6" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" /></>,
  globe: <><circle cx="32" cy="32" r="24" /><path d="M8 32h48M32 8c8 8 8 40 0 48M32 8c-8 8-8 40 0 48" fill="none" stroke="var(--ink)" strokeWidth="3" /></>,
};

export default function Bento() {
  return (
    <section className="bento-sec" aria-labelledby="bento-title">
      <div className="wrap stack-lg">
        <div className="between" data-reveal>
          <h2 id="bento-title" className="display-1">Everything for the <em>big day</em>, in one place.</h2>
        </div>
        <ul className="bento" role="list">
          {TILES.map((t, i) => (
            <li key={t.title} className={`tile tile-${t.size} tile-${t.tone}`} data-reveal data-tilt data-cursor="Open" style={{ '--reveal-delay': `${(i % 4) * 70}ms` }}>
              <Link href={t.href} className="tile-link">
                <svg className="tile-art" viewBox="0 0 64 64" aria-hidden="true">{ART[t.art]}</svg>
                <span className="tile-title">{t.title}</span>
                {t.body && <span className="tile-body">{t.body}</span>}
                <span className="tile-go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
