import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from 'next/font/google';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/chrome.css';
import './styles/home.css';
import './styles/pages.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Reveal from '@/components/ui/Reveal';
import Fx from '@/components/ui/Fx';

const display = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz', 'wdth'], variable: '--font-display', display: 'swap' });
const ui = Instrument_Sans({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono', display: 'swap' });
const accent = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['italic', 'normal'], variable: '--font-accent', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Vendora: plan the party, book the people', template: '%s · Vendora' },
  description: 'Plan an event and book vendors in one place. Every price says where it came from.',
};

export const viewport = { themeColor: '#fbf4e6', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${accent.variable} ${mono.variable}`}>
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
