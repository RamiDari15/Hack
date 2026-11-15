import Link from 'next/link';
import { POPULAR_EVENT_TYPES } from '@/lib/categories';

export default function Close() {
  return (
    <section className="close" aria-labelledby="close-title">
      <div className="wrap stack-lg">
        <h2 id="close-title" className="kicker">So, what are we planning?</h2>
        <ul role="list" className="close-types">
          {POPULAR_EVENT_TYPES.map((t, i) => (
            <li key={t}><Link href={`/events/new?type=${encodeURIComponent(t)}`}>{`${i === 0 ? 'A' : 'a'} ${t.toLowerCase()}`}</Link></li>
          ))}
          <li><Link href="/events/new?type=Other">or <em>something else</em></Link></li>
        </ul>
      </div>
    </section>
  );
}
