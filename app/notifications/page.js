import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import { markNotificationsRead } from '@/app/actions/marketplace';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/notifications');
  const { data } = await supabase.from('notifications').select('id, title, link, read_at, created_at').order('created_at', { ascending: false }).limit(100);
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <div className="page wrap pg pg-notifications">
      <PageHead title="Notifications" size="display-2" lede={unread ? `${unread} new.` : 'Nothing new.'}>
        {unread > 0 && <form action={markNotificationsRead}><button className="btn btn-sm btn-outline" type="submit">Mark all read</button></form>}
        <Link className="btn btn-sm btn-outline" href="/account">Email alert settings</Link>
      </PageHead>
      {list.length ? (
        <ul role="list" className="inbox-list panel">
          {list.map((n) => (
            <li key={n.id} className={n.read_at ? undefined : 'is-unread'}>
              <Link href={n.link || '/dashboard'} className="inbox-row">
                <span className="inbox-dot" aria-hidden="true" />
                <span className="inbox-main"><b>{n.title}</b><span className="fine">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' })}{n.read_at ? '' : ' · new'}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <div className="panel empty"><h3>No notifications yet</h3><p className="muted small">New quotes, messages and booking changes show up here.</p></div>}
    </div>
  );
}
