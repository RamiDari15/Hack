import Link from 'next/link';
import { getSessionUser } from '@/lib/supabase/server';
import MobileNav from './MobileNav';
import NavLinks from './NavLinks';
import AcctMenu from './AcctMenu';

export const NAV = [
  { href: '/vendors', label: 'Vendors' },
  { href: '/planner', label: 'Planner' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/how-it-works', label: 'How it works' },
];

export function Wordmark({ size }) {
  return (
    <span className={`wordmark${size === 'lg' ? ' wordmark-lg' : ''}`}>
      <i className="wordmark-bulb" aria-hidden="true" />vendora
    </span>
  );
}

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16v11a2 2 0 0 1-2 2H9l-5 3V5z" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /><path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

async function counts(supabase, user) {
  if (!supabase || !user) return { inbox: 0, alerts: 0 };
  const [{ data: threads }, { count }] = await Promise.all([
    supabase.rpc('my_inbox'),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  return { inbox: (threads ?? []).reduce((n, t) => n + (t.unread || 0), 0), alerts: count ?? 0 };
}

const badge = (n) => (n > 0 ? <span className="nav-count">{n > 99 ? '99+' : n}<span className="sr-only"> unread</span></span> : null);

export default async function Header() {
  const { supabase, user } = await getSessionUser();
  const c = await counts(supabase, user).catch(() => ({ inbox: 0, alerts: 0 }));
  const name = user?.user_metadata?.full_name || user?.email || '';
  const initial = (name.trim()[0] || 'Y').toUpperCase();
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href="/" className="wordmark-link" aria-label="Vendora home"><Wordmark /></Link>
        <nav aria-label="Primary" className="nav-desktop"><NavLinks items={NAV} /></nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link href="/inbox" className="icon-link" aria-label={c.inbox ? `Inbox, ${c.inbox} unread` : 'Inbox'}><InboxIcon />{badge(c.inbox)}</Link>
              <Link href="/notifications" className="icon-link" aria-label={c.alerts ? `Notifications, ${c.alerts} new` : 'Notifications'}><BellIcon />{badge(c.alerts)}</Link>
              <Link href="/dashboard" className="btn btn-sm btn-bulb">Your events</Link>
              <AcctMenu initial={initial} label={`Account menu for ${name}`}>
                  <Link href="/account">Account</Link>
                  <Link href="/account#todo-h">To-dos</Link>
                  <Link href="/saved">Saved vendors</Link>
                  <Link href="/inbox">Inbox {badge(c.inbox)}</Link>
                  <Link href="/vendor">Vendor dashboard</Link>
                  <hr />
                  <form action="/auth/sign-out" method="post"><button type="submit">Sign out</button></form>
              </AcctMenu>
            </>
          ) : (
            <>
              <Link href="/vendors/join" className="nav-quiet">For vendors</Link>
              <Link href="/sign-in" className="nav-quiet">Sign in</Link>
              <Link href="/events/new" className="btn btn-sm btn-bulb">Start planning <span className="arrow" aria-hidden="true">→</span></Link>
            </>
          )}
        </div>
        <MobileNav items={NAV} signedIn={Boolean(user)} inbox={c.inbox} />
      </div>
    </header>
  );
}
