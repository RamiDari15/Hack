import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';
import MarqueePause from './MarqueePause';

// Two copies of the list scroll as one band; the second copy is hidden from assistive tech.
export default function Marquee() {
  const row = (hidden) => (
    <ul className="marquee-row" aria-hidden={hidden || undefined} role="list">
      {CATEGORIES.map((c) => (
        <li key={c}>
          {hidden ? <span>{c}</span> : <Link href={`/vendors?category=${encodeURIComponent(c)}`}>{c}</Link>}
          <span className="marquee-dot" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="marquee" aria-label="Vendor categories">
      <div className="marquee-track">{row(false)}{row(true)}</div>
      <MarqueePause />
    </section>
  );
}
