import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import MobileNav from './MobileNav';

export const NAV = [
  { href: '/vendors', label: 'Vendors' },
  { href: '/planner', label: 'Planner' },
  { href: '/discover', label: 'Web search' },
  { href: '/how-it-works', label: 'How it works' },
];

export function Wordmark({ size }) {
  return (
    <span className={`wordmark${size === 'lg' ? ' wordmark-lg' : ''}`}>
      <i className="wordmark-bulb" aria-hidden="true" />Vendora
    </span>
  );
}

export default async function Header() {
  const { user } = await getSessionUser();
  return (
    <header className="site-header on-dusk">
      <div className="wrap site-header-inner">
        <Link href="/" className="wordmark-link" aria-label="Vendora home"><Wordmark /></Link>
        <nav aria-label="Primary" className="nav-desktop">
          <ul role="list">
            {NAV.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}
          </ul>
        </nav>
        <div className="header-actions">
          <Link href={user ? '/vendor' : '/vendors/join'} className="nav-quiet">For vendors</Link>
          {user ? (
            <>
              <Link href="/account#todo-h" className="nav-quiet">To-dos</Link>
              <Link href="/account" className="nav-quiet">Account</Link>
              <Link href="/dashboard" className="btn btn-sm btn-bulb">Your events</Link>
              <form action="/auth/sign-out" method="post">
                <button type="submit" className="nav-quiet as-link">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="nav-quiet">Sign in</Link>
              <Link href="/events/new" className="btn btn-sm btn-bulb">Start planning</Link>
            </>
          )}
        </div>
        <MobileNav items={NAV} signedIn={Boolean(user)} />
      </div>
    </header>
  );
}
