import PageHead from '@/components/PageHead';
import { sampleSponsors } from '@/lib/sample-data';

export const metadata = { title: 'Sponsorships' };

const STEPS = [
  'Describe the audience, place, theme, attendance and what you can offer a sponsor',
  'Web research finds possible sponsors',
  'The planner explains each match and drafts a proposal',
  'You approve every recipient and every message',
  'Track replies, follow-ups and agreed benefits',
];

export default function SponsorshipsPage() {
  return (
    <div className="page wrap">
      <PageHead title="Find sponsors who fit your crowd." lede="For festivals, fundraisers and community events. Nothing is ever sent without your approval." />
      <p className="notice notice-warn">Preview only. The sponsor database is not populated, no sponsor contacts are shown, and sending is not built.</p>
      <section className="split-section" aria-labelledby="sp-how">
        <h2 id="sp-how" className="display-2">How it will work</h2>
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
