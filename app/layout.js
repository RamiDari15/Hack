import { Schibsted_Grotesk } from 'next/font/google';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/chrome.css';
import './styles/home.css';
import './styles/pages.css';
import './styles/walk.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Reveal from '@/components/ui/Reveal';
import Fx from '@/components/ui/Fx';

// One newsroom grotesk for headlines and text, so the page reads as designed, not generated.
const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Vendora: plan the party, book the people', template: '%s · Vendora' },
  description: 'Plan an event and book vendors in one place. Every price says where it came from.',
};

export const viewport = { themeColor: '#fbf4e6', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <Reveal />
        <Fx />
      </body>
    </html>
  );
}
