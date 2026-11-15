'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { stopPosition, TONES, SHORT } from './stations';

const WalkScene = dynamic(() => import('./WalkScene'), { ssr: false, loading: () => <div className="walk-stage walk-loading" aria-hidden="true" /> });

// The shell around a walkthrough: the 3D floor (or a flat floor plan), arrows to move between stops,
// and a side panel the caller fills for the current stop. Arrow keys work while focus is inside.
export default function Walk({ stops, renderDetail, renderOverview, label = 'Event walkthrough' }) {
  const [active, setActive] = useState(-1);
  const [mode, setMode] = useState('3d');
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const r = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduce(r);
    let gl = false;
    try { const c = document.createElement('canvas'); gl = Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { gl = false; }
    if (!gl) setMode('plan');
  }, []);
  const n = stops.length;
  const go = (d) => setActive((a) => (a < 0 ? (d > 0 ? 0 : n - 1) : (a + d + n) % n));
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'Escape') setActive(-1);
  };
  const cur = active >= 0 ? stops[active] : null;
  const filled = stops.filter((s) => s.filled).length;

  return (
    <section className="walk" aria-label={label} onKeyDown={onKey}>
      <div className="walk-view">
        {mode === '3d'
          ? <WalkScene stops={stops} active={active} onSelect={setActive} reduce={reduce} />
          : <FloorPlan stops={stops} active={active} onSelect={setActive} />}
        <div className="walk-hud">
          <div className="walk-modes" role="group" aria-label="View">
            <button type="button" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>3D</button>
            <button type="button" aria-pressed={mode === 'plan'} onClick={() => setMode('plan')}>Floor plan</button>
          </div>
          <div className="walk-nav">
            <button type="button" className="walk-arrow" onClick={() => go(-1)} aria-label="Previous stop">←</button>
            <span className="walk-pos" aria-live="polite">{cur ? `${active + 1} of ${n} · ${cur.category}` : `${n} stops · ${filled} with a vendor`}</span>
            <button type="button" className="walk-arrow" onClick={() => go(1)} aria-label="Next stop">→</button>
          </div>
          {active >= 0 && <button type="button" className="walk-overview-btn" onClick={() => setActive(-1)}>See the whole room</button>}
        </div>
      </div>
      <aside className="walk-panel" aria-live="polite">
        {cur ? renderDetail(cur, active) : renderOverview({ start: () => setActive(0), filled, total: n, pick: setActive })}
      </aside>
    </section>
  );
}

// Flat version for reduced motion, no WebGL, or anyone who prefers it. Same layout as the 3D floor.
function FloorPlan({ stops, active, onSelect }) {
  const n = stops.length;
  const pts = useMemo(() => stops.map((_, i) => stopPosition(i, n)), [stops, n]);
  const toPct = (p) => ({ left: `${50 + (p.x / 11.5) * 46}%`, top: `${50 + (p.z / 11.5) * 46}%` });
  return (
    <div className="walk-stage walk-plan">
      <svg className="walk-plan-lines" viewBox="-11.5 -11.5 23 23" aria-hidden="true">
        <ellipse cx="0" cy="0" rx="11.2" ry="9.6" className="walk-plan-rug" />
        {pts.map((p, i) => <line key={i} x1="0" y1="0" x2={p.x} y2={p.z} />)}
        <rect x="-2" y="-2" width="4" height="4" rx=".3" className="walk-plan-floor" />
      </svg>
      {stops.map((s, i) => (
        <button key={s.category} type="button" style={toPct(pts[i])}
          className={`walk-plan-stop tone-${TONES[i % TONES.length]}${i === active ? ' is-active' : ''}${s.filled ? ' is-filled' : ''}`}
          onClick={() => onSelect(i)} aria-pressed={i === active}>
          <b>{SHORT[s.category] ?? s.category}</b>
          <span>{s.count ? `${s.count} picked` : 'Open'}</span>
        </button>
      ))}
      <span className="walk-plan-center" aria-hidden="true">Dance floor</span>
    </div>
  );
}
