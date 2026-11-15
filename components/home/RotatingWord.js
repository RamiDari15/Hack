'use client';

import { useEffect, useState } from 'react';

// Cycles through words with a flip. Screen readers get one stable word; reduced motion shows the first only.
export default function RotatingWord({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 1900);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className="rotor">
      <span className="sr-only">{words[0]}.</span>
      <span className="rotor-word" key={i} aria-hidden="true">{words[i]}<span className="rotor-dot">.</span></span>
    </span>
  );
}
