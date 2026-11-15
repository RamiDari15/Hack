'use client';

import { useEffect, useState } from 'react';

// A short opening on the homepage: terminal lines type out, then a sun wipes the screen away.
// Once per browser session, never with reduced motion, and it never blocks clicks underneath.
const LINES = ['> setting the table', '> stringing the lights', '> calling the band', '> ready.'];

export default function Intro() {
  const [state, setState] = useState('off');
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('vendora-intro') === '1'; sessionStorage.setItem('vendora-intro', '1'); } catch { /* storage blocked */ }
    if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    setState('on');
    const out = setTimeout(() => setState('out'), 1900);
    const done = setTimeout(() => setState('off'), 2700);
    return () => { clearTimeout(out); clearTimeout(done); };
  }, []);
  if (state === 'off') return null;
  return (
    <div className={`intro${state === 'out' ? ' is-out' : ''}`} aria-hidden="true">
      <div className="intro-term">
        {LINES.map((l, i) => <p key={l} style={{ '--i': i }}>{l}</p>)}
      </div>
      <div className="intro-word">vendora<span className="intro-dot" /></div>
      <button type="button" className="intro-skip" tabIndex={-1} onClick={() => setState('off')}>Skip intro ↗</button>
      <span className="intro-wipe" />
    </div>
  );
}
