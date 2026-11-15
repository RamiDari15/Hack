'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav({ items, signedIn, inbox = 0 }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btnRef = useRef(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Keep focus inside the open menu: everything behind it is inert.
    const behind = [document.querySelector('main'), document.querySelector('.site-footer'), document.querySelector('.wordmark-link')].filter(Boolean);
    behind.forEach((el) => { el.inert = true; });
    document.querySelector('#mobile-menu a')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; behind.forEach((el) => { el.inert = false; }); };
  }, [open]);

  return (
    <div className="nav-mobile">
      {signedIn && <Link href="/inbox" className="icon-link" aria-label={inbox ? `Inbox, ${inbox} unread` : 'Inbox'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11a2 2 0 0 1-2 2H9l-5 3V5z" /></svg>
        {inbox > 0 && <span className="nav-count">{inbox > 99 ? '99+' : inbox}</span>}
      </Link>}
      <button ref={btnRef} type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : 'Menu'}
      </button>
      <div id="mobile-menu" className="mobile-panel" hidden={!open} role="dialog" aria-modal="true" aria-label="Menu">
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
              <Link href="/inbox" className="btn btn-ghost btn-block">Inbox{inbox > 0 ? ` (${inbox} unread)` : ''}</Link>
              <Link href="/notifications" className="btn btn-ghost btn-block">Notifications</Link>
              <Link href="/saved" className="btn btn-ghost btn-block">Saved vendors</Link>
              <Link href="/account#todo-h" className="btn btn-ghost btn-block">To-dos</Link>
              <Link href="/account" className="btn btn-ghost btn-block">Account</Link>
              <form action="/auth/sign-out" method="post"><button className="btn btn-ghost btn-block" type="submit">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/events/new" className="btn btn-bulb btn-block">Start planning</Link>
              <Link href="/sign-in" className="btn btn-ghost btn-block">Sign in</Link>
              <Link href="/sign-in/vendor" className="btn btn-ghost btn-block">Vendor sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
