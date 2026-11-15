'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import HeroGL from './HeroGL';
import { EVENT_TYPES } from '@/lib/categories';

// Kinetic headline plus a loose pile of shapes and category cards that lean toward the pointer.
// Motion is CSS; the pointer parallax only runs with a fine pointer and no reduced-motion preference.
const WORDS = [['Throw', 'the', 'party.'], ['Skip', 'the', 'spreadsheet.']];
// Each card shows a status the app really uses, not a made-up figure.
const CARDS = [
  { cat: 'Venues', tone: 'sun', tilt: -7, rows: [['Shortlist', 'voting'], ['Visit', 'to book']] },
  { cat: 'Catering', tone: 'pink', tilt: 5, rows: [['AI ballpark', 'set'], ['Quote', 'pending']] },
  { cat: 'Florists', tone: 'paper', tilt: -3, rows: [['Message', 'unread'], ['Deposit', 'to-do']] },
  { cat: 'Music & DJ', tone: 'ink', tilt: 8, rows: [['Badge', 'verified'], ['Timeline', 'added']] },
];

export default function Hero() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let raf = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3)); });
    };
    el.addEventListener('pointermove', onMove);
    return () => { el.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);

  let i = 0;
  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <HeroGL />
      <div className="hero-shapes" aria-hidden="true">
        <span className="shape shape-sun" />
        <span className="shape shape-pink" />
        <span className="shape shape-ring" />
      </div>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="label hero-sticker"><span>For</span> Weddings · Birthdays · Galas · {EVENT_TYPES.length - 3} more</p>
          <h1 id="hero-title" className="display-hero hero-title">
            {WORDS.map((line, li) => (
              <span className="hero-line" key={li}>
                {line.map((w) => {
                  const d = i++;
                  const em = w === 'party.';
                  return <span className="hero-word" key={w + d} style={{ '--i': d }}>{em ? <em>{w}</em> : w}</span>;
                })}
              </span>
            ))}
          </h1>
          <p className="lede hero-lede">Budget, vendors, guests and the to-do list, all on one page.</p>
          <div className="row hero-ctas">
            <Link href="/events/new" className="btn btn-lg btn-bulb">Start planning <span className="arrow" aria-hidden="true">→</span></Link>
            <Link href="/vendors" className="btn btn-lg btn-outline">Browse vendors</Link>
          </div>
        </div>
        <div className="hero-deck" aria-hidden="true">
          {CARDS.map((c, n) => (
            <div key={c.cat} data-tilt className={`deck-card deck-${c.tone}`} style={{ '--tilt': `${c.tilt}deg`, '--n': n }}>
              <span className="deck-kicker">{String(n + 1).padStart(2, '0')}</span>
              <span className="deck-cat">{c.cat}</span>
              <span className="deck-rows">{c.rows.map(([k, v]) => <span key={k} className="deck-row"><span>{k}</span><b>{v}</b></span>)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
