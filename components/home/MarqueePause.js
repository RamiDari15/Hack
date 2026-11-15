'use client';

import { useState } from 'react';

// Lets anyone stop the moving band (WCAG 2.2.2). Hidden when reduced motion already stops it.
export default function MarqueePause() {
  const [paused, setPaused] = useState(false);
  return (
    <button type="button" className="marquee-pause" aria-pressed={paused}
      onClick={(e) => { const next = !paused; setPaused(next); e.currentTarget.closest('.marquee')?.classList.toggle('is-paused', next); }}>
      {paused ? 'Play' : 'Pause'}<span className="sr-only"> the category band</span>
    </button>
  );
}
