import Link from 'next/link';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'How it works' };

const STEPS = [
  ['Start your event', 'Enter the type, date, place, guest count, style and budget. The planner turns it into a budget and checklist you can change.', 'Live'],
  ['Find vendors', 'Filter verified vendors by category, area and date. Search the web for more, kept apart and marked for you to confirm.', 'Live'],
  ['Request quotes', 'Send an inquiry with your event details after you confirm. A vendor’s quote replaces the estimate in your budget.', 'Inquiries live, replies from vendors planned'],
  ['Keep it together', 'One page per event holds the budget, the vendors, saved web results and the checklist.', 'Live'],
  ['Book and pay', 'Holds, deposits and invoices, with each vendor’s policy shown before you commit.', 'Planned'],
];

const NEXT = [
  ['Weather by date', 'Compare dates with near-term forecasts and seasonal history, shown apart with their source and uncertainty. An indoor backup flag for dates that are often rainy. No weather provider is connected yet.'],
  ['Room preview', 'A concept layout from venue size, guest count and vendor packages. It will be a preview, not a verified floor plan, so dimensions are confirmed with the venue.'],
  ['Sponsors', 'Research finds possible sponsors and drafts a proposal. You approve every message before anything is sent.'],
];

const FAQS = [
  ['How are vendors verified?', 'We review business information and relevant documents. An onboarding quiz can add context, but it never establishes legitimacy by itself.'],
  ['How accurate are the planner’s estimates?', 'They are estimates. When a vendor sends a quote, it replaces the estimate in your budget, and the two are labeled differently.'],
  ['What are web results?', 'Results from web search, shown apart from verified vendors with a link to the source. Their details need your confirmation.'],
  ['Does anything get sent or booked automatically?', 'No. Inquiries go out only after you tick the confirmation, and nothing is booked or paid from Vendora yet.'],
  ['How do payments and cancellations work?', 'Deposits, installments and invoices will be tracked in one place, with each vendor’s cancellation policy shown before you book. Online payments are not live yet.'],
  ['How do I join as a vendor?', 'Create a profile, add your services and portfolio, and submit your business information for review. Fees are shown before you commit.'],
];

export default function HowItWorksPage() {
  return (
    <div className="page wrap">
      <PageHead title="From the first idea to the night itself." lede="Five steps. Each one says whether it works today or is still being built." />

      <ol className="hiw-steps">
        {STEPS.map(([t, d, status], i) => (
          <li key={t}>
            <span className="hiw-n" aria-hidden="true">{i + 1}</span>
            <div className="stack-sm">
              <h2 className="display-3">{t}</h2>
              <p className="muted measure">{d}</p>
            </div>
            <span className={`badge ${status === 'Live' ? 'badge-ok' : status === 'Planned' ? 'badge-plain' : 'badge-info'}`}>{status}</span>
          </li>
        ))}
      </ol>
      <div className="row"><Link className="btn" href="/events/new">Start an event</Link><Link className="btn btn-outline" href="/vendors">Browse vendors</Link></div>

      <section className="split-section" aria-labelledby="next-h">
        <h2 id="next-h" className="display-2">Planned next</h2>
        <dl className="def-list">{NEXT.map(([t, d]) => <div key={t}><dt className="title">{t}</dt><dd className="muted">{d}</dd></div>)}</dl>
      </section>

      <section className="split-section" id="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="display-2">Questions</h2>
        <div className="faq">{FAQS.map(([q, a]) => <details key={q} className="disclosure"><summary>{q}</summary><p className="muted">{a}</p></details>)}</div>
      </section>
    </div>
  );
}
