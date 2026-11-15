'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// "Or just type it": a command types itself out when the section scrolls in, then the lines
// list what the planner does. It describes features, not results, so there are no numbers to invent.
const CMD = 'A garden wedding for 150 in June, around Ann Arbor';
const OUT = [
  ['ok', 'budget split by category, sized to your number'],
  ['ok', 'tips, delivery, setup and cleanup as their own rows'],
  ['ok', 'listed vendors near you, matched to each category'],
  ['ok', 'a to-do list with dates'],
  ['wait', 'quotes replace the ballpark as vendors reply'],
];

export default function Terminal() {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setN(CMD.length); setShown(OUT.length); return undefined; }
    let timer;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let i = 0;
      const type = () => {
        i += 1; setN(i);
        if (i < CMD.length) timer = setTimeout(type, 22 + Math.random() * 40);
        else { let k = 0; const show = () => { k += 1; setShown(k); if (k < OUT.length) timer = setTimeout(show, 260); }; timer = setTimeout(show, 350); }
      };
      timer = setTimeout(type, 300);
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);
  const typing = n < CMD.length;
  return (
    <section className="term-sec" aria-labelledby="term-title">
      <div className="wrap term-grid">
        <div className="stack-lg" data-reveal>
          <h2 id="term-title" className="display-1">Or just <em>type it.</em></h2>
          <p className="lede">One line about your party is enough to start. Add details whenever you like.</p>
          <Link href="/planner" className="btn btn-lg btn-pink">Open the planner <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
        <div className="ask" ref={ref}>
          <p className="sr-only">Example: {CMD}. The planner returns: {OUT.map((o) => o[1]).join('; ')}.</p>
          <div className="ask-input" aria-hidden="true">
            <span className="ask-text">{CMD.slice(0, n)}<span className={`term-caret${typing ? '' : ' is-idle'}`} /></span>
            <span className={`ask-send${typing ? '' : ' is-ready'}`}>Build my plan →</span>
          </div>
          <ul className="ask-out" aria-hidden="true" role="list">
            {OUT.map(([k, t], i) => <li key={t} className={`ask-line ask-${k}${i < shown ? ' is-in' : ''}`}><b>{k === 'ok' ? '✓' : '…'}</b><span>{t}</span></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
