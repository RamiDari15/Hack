import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import NewPasswordForm from './NewPasswordForm';

export const metadata = { title: 'Set a new password' };

// Reached from the password reset email (through /auth/callback) or from Account.
export default async function NewPasswordPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/account/password');
  return (
    <div className="page wrap pg pg-password">
      <PageHead back={{ href: '/account', label: 'Account' }} title="Set a new password" size="display-2" lede={`For ${user.email}.`} />
      <section className="panel stack measure"><NewPasswordForm /></section>
    </div>
  );
}
