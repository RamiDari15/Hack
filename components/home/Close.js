import Link from 'next/link';
import { EVENT_TYPES } from '@/lib/categories';

export default function Close() {
  const types = EVENT_TYPES.filter((t) => t !== 'Other');
  return (
    <section className="close on-dusk" aria-labelledby="close-title">
      <div className="wrap stack-lg">
        <h2 id="close-title" className="lede close-q">What are you planning?</h2>
        <ul role="list" className="close-types">
          {types.map((t, i) => (
            <li key={t}><Link href={`/events/new?type=${encodeURIComponent(t)}`}>{`${i === 0 ? 'A' : 'a'} ${t.toLowerCase()}`}</Link></li>
          ))}
          <li><Link href="/events/new?type=Other">or something else</Link></li>
        </ul>
        <p className="fine">Each one opens a new event with that type filled in. Only you can see it.</p>
      </div>
    </section>
  );
}
