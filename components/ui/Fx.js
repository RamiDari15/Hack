'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Site-wide interaction layer. Everything here is decoration: with reduced motion or a touch screen
// most of it switches off, and nothing it does changes what the page says or where links go.
//  - scroll progress bar, and a --scroll variable on the hero only (parallax)
//  - magnetic pull on .btn-bulb, .btn-pink, .btn-lg and [data-magnetic]
//  - 3D tilt on [data-tilt]
// Scroll work writes to one element per frame, never to <html>, so the page is not restyled while scrolling.
export default function Fx() {
  const path = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const cleanups = [];

    // Scroll progress (transform on the bar) and hero parallax (variable on the hero only).
    const bar = document.querySelector('.scroll-progress');
    const hero = document.querySelector('.hero');
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        if (bar) bar.style.transform = `scaleX(${(y / max).toFixed(4)})`;
        if (hero && !reduce && y < hero.offsetHeight + 200) hero.style.setProperty('--scroll', String(Math.round(y)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); });

    if (reduce || !fine) return () => cleanups.forEach((f) => f());

    // Magnetic buttons and 3D tilt, by delegation so new content picks it up.
    const MAG = '.btn-bulb, .btn-pink, .btn-lg, [data-magnetic]';
    let magEl = null, tiltEl = null, magRect = null, tiltRect = null;
    const onPM = (e) => {
      const m = e.target.closest?.(MAG);
      if (magEl && magEl !== m) { magEl.style.translate = ''; magEl = null; }
      if (m) {
        // Measure once on entry, before our own offset moves the button, so it does not drift.
        if (magEl !== m || !magRect) { m.style.translate = ''; magRect = m.getBoundingClientRect(); }
        const r = magRect;
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        m.style.translate = `${dx * 0.22}px ${dy * 0.3}px`; magEl = m;
      }
      const t = e.target.closest?.('[data-tilt]');
      if (tiltEl && tiltEl !== t) { tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); tiltEl = null; }
      if (t) {
        if (tiltEl !== t || !tiltRect) tiltRect = t.getBoundingClientRect();
        const r = tiltRect;
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        t.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`); t.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
        t.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`); t.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
        tiltEl = t;
      }
    };
    const forget = () => { magRect = null; tiltRect = null; if (magEl) { magEl.style.translate = ''; magEl = null; } };
    document.addEventListener('pointermove', onPM, { passive: true });
    window.addEventListener('scroll', forget, { passive: true });
    cleanups.push(() => { document.removeEventListener('pointermove', onPM); window.removeEventListener('scroll', forget); });

    return () => cleanups.forEach((f) => f());
  }, [path]);

  return <div className="scroll-progress" aria-hidden="true" />;
}
