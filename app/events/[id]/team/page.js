import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, formatDate } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import CopyButton from '@/components/ui/CopyButton';
import { inviteCohost, removeCohost } from '@/app/actions/marketplace';

export const metadata = { title: 'Planning team' };

async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

export default async function TeamPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/team`);
  const [{ data: event }, { data: people }, { data: invites }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title').eq('id', id).maybeSingle(),
    supabase.rpc('event_people', { e: id }),
    supabase.from('event_invites').select('id, email, token, accepted_at, created_at').eq('event_id', id).is('accepted_at', null).order('created_at'),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const origin = await siteOrigin();
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap ev">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Planning team" size="display-2"
        lede="Invite a partner, friend or planner. They can shortlist, vote, comment, message vendors and own tasks. Only you send inquiries, accept quotes or confirm bookings." />
      <div className="event-layout">
        <section className="panel stack" aria-labelledby="people-h">
          <h2 id="people-h">People</h2>
          <ul role="list" className="booking-list">
            {(people ?? []).map((p) => (
              <li key={p.user_id}>
                <p className="title">{p.display_name}{p.user_id === user.id ? ' (you)' : ''}</p>
                <div className="row">
                  <span className={`badge ${p.is_owner ? 'badge-accent' : 'badge-plain'}`}>{p.is_owner ? 'Owner' : 'Co-host'}</span>
                  {!p.is_owner && (isOwner || p.user_id === user.id) && (
                    <form action={removeCohost}>{hidden}<input type="hidden" name="user_id" value={p.user_id} /><button className="btn btn-sm btn-outline" type="submit">{p.user_id === user.id ? 'Leave' : 'Remove'}</button></form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isOwner && (invites ?? []).length > 0 && (
            <>
              <h3 className="label">Waiting to join</h3>
              <ul role="list" className="booking-list">
                {invites.map((i) => (
                  <li key={i.id}>
                    <div><p className="title">{i.email}</p><p className="fine">Invited {formatDate(i.created_at.slice(0, 10))}</p></div>
                    <div className="row">
                      <CopyButton text={`${origin}/invites/${i.token}`} label="Copy invite link" />
                      <a className="btn btn-sm btn-outline" href={`mailto:${i.email}?subject=${encodeURIComponent(`Help me plan ${event.title}`)}&body=${encodeURIComponent(`Join me on Vendora to plan ${event.title}: ${origin}/invites/${i.token}\n\nSign in with this email address to accept.`)}`}>Email invite</a>
                      <form action={removeCohost}>{hidden}<input type="hidden" name="invite_id" value={i.id} /><button className="btn btn-sm btn-outline" type="submit">Cancel</button></form>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {isOwner && (
          <aside className="stack-lg">
            <section className="panel stack" aria-labelledby="inv-h">
              <h2 id="inv-h" className="title">Invite someone</h2>
              <ActionForm action={inviteCohost} resetOnOk>
                {hidden}
                <div className="field"><label htmlFor="inv-email">Their email</label><input id="inv-email" name="email" type="email" required maxLength={200} /></div>
                <button className="btn" type="submit">Create invite link</button>
              </ActionForm>
              <p className="fine">Vendora does not email the invite. Copy the link or use Email invite to send it from your own mail app. It only works for that email address.</p>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
