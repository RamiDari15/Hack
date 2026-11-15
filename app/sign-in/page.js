import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { authProviders, isSupabaseConfigured, safeNext } from '@/lib/supabase/config';
import Placeholder from '@/components/ui/Placeholder';
import SignInForm from './SignInForm';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }) {
  const sp = await searchParams;
  const next = safeNext(sp?.next);
  const { user } = await getSessionUser();
  if (user) redirect(next);

  return (
    <div className="auth">
      <div className="auth-art on-dusk" aria-hidden="true">
        <Placeholder ratio="auto" caption="" seed={2} />
        <p className="display-1">Your events, saved in one place.</p>
      </div>
      <div className="auth-panel">
        <div className="stack-lg auth-box">
          <div className="stack">
            <h1 className="display-2">Sign in</h1>
            <p className="muted">One account for planning events and, later, for running a vendor business. New here? The same link creates your account.</p>
          </div>
          {!isSupabaseConfigured && (
            <p className="notice notice-warn" role="status">Sign-in is not connected yet. Add the Supabase URL and anon key to .env.local, then restart the app.</p>
          )}
          {sp?.error && <p className="notice notice-error" role="alert">{String(sp.error).slice(0, 200)}</p>}
          <SignInForm next={next} providers={authProviders} enabled={isSupabaseConfigured} />
          <p className="fine">By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link> (drafts, pending review).</p>
        </div>
      </div>
    </div>
  );
}
