'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Adds html.js so [data-reveal] content can start hidden, then fades each piece in as it scrolls into view.
// Also flags html.scrolled for the header. With reduced motion the CSS never hides anything.
export default function Reveal() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');
    const onScroll = () => root.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    let io;
    const els = [...document.querySelectorAll('[data-reveal]:not(.is-in)')];
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      els.forEach((el) => io.observe(el));
    } else els.forEach((el) => el.classList.add('is-in'));
    // Safety net: never leave content hidden if an observer misses it.
    const t = setTimeout(() => document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
    }), 1200);
    return () => { window.removeEventListener('scroll', onScroll); io?.disconnect(); clearTimeout(t); };
  }, [path]);
  return null;
}
