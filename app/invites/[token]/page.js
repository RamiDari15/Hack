import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import { acceptInvite } from '@/app/actions/marketplace';

export const metadata = { title: 'Join an event', robots: { index: false } };

export default async function InvitePage({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(token)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/invites/${token}`);
  return (
    <div className="page wrap measure stack">
      <h1 className="display-2">Join the planning team</h1>
      <p className="lede">You were invited to help plan an event on Vendora. Accept to see it, shortlist and vote on vendors, comment and take on tasks.</p>
      <p className="small muted">Signed in as {user.email}. The invite only works for the email address it was sent to.</p>
      {sp?.error && <p className="notice notice-error" role="alert">{String(sp.error).slice(0, 140)}</p>}
      <form action={acceptInvite}><input type="hidden" name="token" value={token} /><button className="btn" type="submit">Accept invite</button></form>
    </div>
  );
}
