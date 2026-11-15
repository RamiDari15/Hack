import { Big_Shoulders, Hanken_Grotesk } from 'next/font/google';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/chrome.css';
import './styles/home.css';
import './styles/pages.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const display = Big_Shoulders({ subsets: ['latin'], axes: ['opsz'], variable: '--font-display', display: 'swap' });
const ui = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Vendora: plan the night', template: '%s · Vendora' },
  description: 'Plan an event and book verified vendors. Every price is marked as an estimate, a web result or a real quote.',
};

export const viewport = { themeColor: '#2b2140', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
