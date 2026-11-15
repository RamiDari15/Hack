import Link from 'next/link';
import PageHead from '@/components/PageHead';
import { sampleSponsors } from '@/lib/sample-data';

export const metadata = { title: 'Sponsorships' };

const STEPS = [
  'Open your event and choose Contact sponsors',
  'Search the web for local businesses that fit your crowd, or add ones you know',
  'Vendora drafts a proposal from your event details. Edit it to say what you can offer',
  'Email each sponsor from your own inbox. Vendora never sends anything for you',
  'Mark who you contacted, who agreed and who declined',
];

export default function SponsorshipsPage() {
  return (
    <div className="page wrap">
      <PageHead title="Find sponsors who fit your crowd." lede="For festivals, fundraisers and community events. Nothing is ever sent without your approval." />
      <div className="row page-actions">
        <Link className="btn btn-bulb" href="/dashboard">Contact sponsors for an event</Link>
        <Link className="btn btn-outline" href="/events/new">Create an event</Link>
      </div>
      <section className="split-section" aria-labelledby="sp-how">
        <h2 id="sp-how" className="display-2">How it works</h2>
        <ol className="num-list">{STEPS.map((s) => <li key={s}><p>{s}</p></li>)}</ol>
      </section>
      <section className="split-section" aria-labelledby="sp-ex">
        <h2 id="sp-ex" className="display-2">What a match looks like</h2>
        <div className="stack">
          {sampleSponsors.map((s) => (
            <article className="panel stack-sm" key={s.name}>
              <div className="between"><h3 className="title">{s.name}</h3><span className="badge">Sample match</span></div>
              <p className="small muted">{s.reason}</p>
              <div className="row"><span className="badge badge-plain">Awaiting your review</span><span className="badge badge-plain">Offer: {s.benefit}</span></div>
            </article>
          ))}
          <p className="fine">Sample data for layout. These are not real businesses.</p>
        </div>
      </section>
    </div>
  );
}
