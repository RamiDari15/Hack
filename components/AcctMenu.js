'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// <details> account menu that also closes on Escape, an outside click, and navigation.
export default function AcctMenu({ label, initial, children }) {
  const ref = useRef(null);
  const path = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  useEffect(() => {
    const el = ref.current;
    const onKey = (e) => { if (e.key === 'Escape' && el?.open) { el.open = false; el.querySelector('summary')?.focus(); } };
    const onDown = (e) => { if (el?.open && !el.contains(e.target)) el.open = false; };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, []);
  return (
    <details className="acct" ref={ref}>
      <summary><span aria-hidden="true">{initial}</span><span className="sr-only">{label}</span></summary>
      <div className="acct-menu">{children}</div>
    </details>
  );
}
