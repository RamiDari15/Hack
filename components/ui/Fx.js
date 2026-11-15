'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Site-wide interaction layer. Everything here is decoration: with reduced motion or a touch screen
// most of it switches off, and nothing it does changes what the page says or where links go.
//  - scroll progress bar, and a --scroll variable on the hero only (parallax)
//  - a custom cursor that grows over links and shows a label from [data-cursor]
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

    // Custom cursor.
    root.classList.add('has-cursor');
    const dot = document.createElement('div'); dot.className = 'cursor-dot';
    const ring = document.createElement('div'); ring.className = 'cursor-ring';
    const label = document.createElement('span'); ring.appendChild(label);
    dot.setAttribute('aria-hidden', 'true'); ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring, dot);
    const pos = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
    let craf = 0, shown = false;
    const loop = () => {
      pos.rx += (pos.x - pos.rx) * 0.35; pos.ry += (pos.y - pos.ry) * 0.35;
      dot.style.translate = `${pos.x}px ${pos.y}px`;
      ring.style.translate = `${pos.rx}px ${pos.ry}px`; // translate, not transform, so the scale states grow in place
      // Stop once the ring has caught up; the next pointer move starts it again.
      craf = Math.abs(pos.x - pos.rx) + Math.abs(pos.y - pos.ry) > 0.2 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
      if (!craf) craf = requestAnimationFrame(loop);
      if (!shown) { shown = true; root.classList.add('cursor-on'); }
      const t = e.target.closest?.('a, button, summary, label, select, [data-cursor]');
      const text = e.target.closest?.('input, textarea');
      ring.classList.toggle('is-link', Boolean(t) && !text);
      ring.classList.toggle('is-text', Boolean(text));
      const lab = e.target.closest?.('[data-cursor]')?.dataset.cursor || '';
      label.textContent = lab; ring.classList.toggle('has-label', Boolean(lab));
    };
    const onLeave = () => { shown = false; root.classList.remove('cursor-on'); };
    const onDown = () => ring.classList.add('is-down');
    const onUp = () => ring.classList.remove('is-down');
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    cleanups.push(() => {
      cancelAnimationFrame(craf); dot.remove(); ring.remove(); root.classList.remove('has-cursor', 'cursor-on');
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerdown', onDown); document.removeEventListener('pointerup', onUp);
    });

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
