'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Site-wide interaction layer. Everything here is decoration: with reduced motion or a touch screen
// most of it switches off, and nothing it does changes what the page says or where links go.
//  - scroll progress bar and --scroll / --vel CSS variables (parallax, marquee skew)
//  - a custom cursor that grows over links and shows a label from [data-cursor]
//  - magnetic pull on .btn-bulb, .btn-pink, .btn-lg and [data-magnetic]
//  - 3D tilt on [data-tilt]
//  - scrambled-text reveal on .kicker labels
const GLYPHS = '!<>-_\\/[]{}=+*^?#ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

function scramble(el) {
  const final = el.dataset.text || el.textContent;
  el.dataset.text = final;
  el.setAttribute('aria-label', final);
  let frame = 0;
  const total = 22;
  const tick = () => {
    const progress = frame / total;
    el.textContent = [...final].map((ch, i) => (ch === ' ' || i / final.length < progress ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (frame++ < total) requestAnimationFrame(tick); else el.textContent = final;
  };
  tick();
}

export default function Fx() {
  const path = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const cleanups = [];

    // Scroll progress and velocity.
    let last = window.scrollY, vel = 0, raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        root.style.setProperty('--progress', (y / max).toFixed(4));
        root.style.setProperty('--scroll', String(Math.round(y)));
        if (!reduce) { vel = Math.max(-40, Math.min(40, y - last)); root.style.setProperty('--vel', vel.toFixed(1)); }
        last = y;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const settle = setInterval(() => { if (Math.abs(vel) > 0.1) { vel *= 0.8; root.style.setProperty('--vel', vel.toFixed(1)); } }, 50);
    cleanups.push(() => { window.removeEventListener('scroll', onScroll); clearInterval(settle); });

    // Scramble kickers as they come into view.
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { scramble(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
      document.querySelectorAll('.kicker').forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

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
      pos.rx += (pos.x - pos.rx) * 0.18; pos.ry += (pos.y - pos.ry) * 0.18;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.style.transform = `translate3d(${pos.rx}px, ${pos.ry}px, 0)`;
      craf = requestAnimationFrame(loop);
    };
    craf = requestAnimationFrame(loop);
    const onMove = (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
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
    let magEl = null, tiltEl = null;
    const onPM = (e) => {
      const m = e.target.closest?.(MAG);
      if (magEl && magEl !== m) { magEl.style.translate = ''; magEl = null; }
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        m.style.translate = `${dx * 0.22}px ${dy * 0.3}px`; magEl = m;
      }
      const t = e.target.closest?.('[data-tilt]');
      if (tiltEl && tiltEl !== t) { tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); tiltEl = null; }
      if (t) {
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        t.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`); t.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
        t.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`); t.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
        tiltEl = t;
      }
    };
    document.addEventListener('pointermove', onPM, { passive: true });
    cleanups.push(() => document.removeEventListener('pointermove', onPM));

    return () => cleanups.forEach((f) => f());
  }, [path]);

  return <div className="scroll-progress" aria-hidden="true" />;
}
