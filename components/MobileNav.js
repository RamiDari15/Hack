'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav({ items, signedIn }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btnRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="nav-mobile">
      <button ref={btnRef} type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <div id="mobile-menu" className="mobile-panel on-dusk" hidden={!open}>
        <nav aria-label="Mobile">
          <ul role="list">
            {items.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}
            <li><Link href={signedIn ? '/vendor' : '/vendors/join'}>For vendors</Link></li>
          </ul>
        </nav>
        <div className="mobile-actions">
          {signedIn ? (
            <>
              <Link href="/dashboard" className="btn btn-bulb btn-block">Your events</Link>
              <form action="/auth/sign-out" method="post"><button className="btn btn-ghost btn-block" type="submit">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/events/new" className="btn btn-bulb btn-block">Start planning</Link>
              <Link href="/sign-in" className="btn btn-ghost btn-block">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
