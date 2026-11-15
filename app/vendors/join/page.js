import Link from 'next/link';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Join as a vendor' };

const NEEDS = [
  ['Business details', 'Legal name, address and contact details.'],
  ['Proof of business', 'Your registration number and website, so we can check the business is real.'],
  ['Your work', 'Categories, service area and a portfolio.'],
  ['Packages', 'Prices, or a note that you quote per event.'],
];

const GET = [
  ['A verified profile', 'Your business, portfolio and service area, shown to people planning nearby.'],
  ['Inquiries with the details', 'Each request arrives with the date, place and guest count, so you can quote straight away.'],
  ['Quotes that count', 'Your quote replaces the planner’s estimate in the customer’s budget, labeled as yours.'],
];

export default function JoinPage() {
  return (
    <>
      <section className="join-hero on-dusk">
        <div className="wrap">
          <PageHead title="Bring your work to the night." lede="Venues, caterers, DJs, photographers, florists and rental companies: get inquiries from people planning events near you." size="display-1">
            <Link className="btn btn-bulb" href="/vendor/apply">Apply now</Link>
            <a className="btn btn-ghost" href="#fees">How fees work</a>
          </PageHead>
        </div>
      </section>
      <div className="page wrap stack-lg">
        <section className="split-section" aria-labelledby="get-h">
          <h2 id="get-h" className="display-2">What you get</h2>
          <dl className="def-list">{GET.map(([t, d]) => <div key={t}><dt className="title">{t}</dt><dd className="muted">{d}</dd></div>)}</dl>
        </section>
        <section className="split-section" id="apply" aria-labelledby="apply-h">
          <h2 id="apply-h" className="display-2">Four things, then we review</h2>
          <ol className="num-list">{NEEDS.map(([t, d]) => <li key={t}><div><b>{t}</b><p className="muted small">{d}</p></div></li>)}</ol>
        </section>
        <section className="split-section" aria-labelledby="ver-h">
          <h2 id="ver-h" className="display-2">How verification works</h2>
          <div className="stack"><p className="lede">We review your business information and documents. An onboarding quiz can add context, but it never establishes legitimacy by itself.</p>
            <p className="muted">Until verification is complete, your profile does not appear in search and customers cannot send you inquiries.</p></div>
        </section>
        <section className="split-section" id="fees" aria-labelledby="fees-h">
          <h2 id="fees-h" className="display-2">Fees, before you commit</h2>
          <div className="stack">
            <p className="lede">Plans, booking commissions, paid leads and sponsored listings will be listed here in full. Nothing is charged until you agree to a plan.</p>
            <p className="notice">Fee terms are not set yet, so no prices are shown.</p>
            <div className="row"><Link className="btn" href="/vendor/apply">Apply as a vendor</Link><Link className="btn btn-outline" href="/support">Ask a question</Link></div>
          </div>
        </section>
      </div>
    </>
  );
}
