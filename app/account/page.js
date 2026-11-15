import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { updateAccount } from '@/app/actions/marketplace';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/account');
  const { data: profile } = await supabase.from('profiles').select('display_name, email_alerts').eq('id', user.id).maybeSingle();
  return (
    <div className="page wrap">
      <PageHead back={{ href: '/dashboard', label: 'Your events' }} title="Account" size="display-2" lede={user.email} />
      <section className="panel stack measure" aria-labelledby="acct-h">
        <h2 id="acct-h" className="title">Profile and alerts</h2>
        <ActionForm action={updateAccount}>
          <div className="field"><label htmlFor="display_name">Name</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} required maxLength={120} /></div>
          <label className="check-row"><input type="checkbox" name="email_alerts" defaultChecked={profile?.email_alerts ?? true} /><span>Email me when a quote, message or booking update arrives.</span></label>
          <div className="row"><button className="btn" type="submit">Save</button></div>
        </ActionForm>
        <p className="small"><Link href="/account/password">Change password</Link></p>
      </section>
    </div>
  );
}
