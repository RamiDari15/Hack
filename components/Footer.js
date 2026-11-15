import Link from 'next/link';
import { Wordmark } from './Header';

const LINKS = [
  ['/events/new', 'Start an event'], ['/vendors', 'Find vendors'], ['/planner', 'Planner'], ['/discover', 'Web search'],
  ['/how-it-works', 'How it works'], ['/vendors/join', 'Join as a vendor'], ['/sponsorships', 'Sponsorships'],
  ['/support', 'Support'], ['/privacy', 'Privacy'], ['/terms', 'Terms'],
];

export default function Footer() {
  return (
    <footer className="site-footer on-dusk">
      <div className="wrap footer-inner">
        <div className="stack">
          <Wordmark size="lg" />
          <p className="footer-tag">Plan the party. <em className="accent">Book the people.</em></p>
        </div>
        <nav aria-label="Footer">
          <ul role="list" className="footer-links">
            {LINKS.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}
          </ul>
        </nav>
      </div>
      <div className="wrap footer-base fine">
        <span>© {new Date().getFullYear()} Vendora</span>
        <span>Nothing is booked, paid or sent without your OK.</span>
      </div>
    </footer>
  );
}
