import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { authProviders, isSupabaseConfigured, safeNext } from '@/lib/supabase/config';
import Placeholder from '@/components/ui/Placeholder';
import SignInForm from './SignInForm';

// Two doors, one account system: planners sign in at /sign-in, vendors at /sign-in/vendor.
// The vendor door adds the vendor role and sends new vendors to the application.
const COPY = {
  planner: {
    art: 'Your events, saved in one place.',
    signIn: 'Sign in to plan',
    signUp: 'Create your planner account',
    lede: 'Plan events, compare vendors and keep guests, budget and bookings in one place.',
    other: { text: 'Run a venue, catering or other event business?', link: 'Vendor sign in', href: '/sign-in/vendor' },
    nextIn: '/dashboard', nextUp: '/dashboard',
  },
  vendor: {
    art: 'Get booked for the big night.',
    signIn: 'Vendor sign in',
    signUp: 'Create your vendor account',
    lede: 'Get inquiries, send quotes, hold dates and confirm bookings. New vendors apply next and appear once Vendora verifies them.',
    other: { text: 'Planning an event?', link: 'Sign in as a planner', href: '/sign-in' },
    nextIn: '/vendor', nextUp: '/vendor/apply',
  },
};

export default async function AuthScreen({ searchParams, audience }) {
  const sp = await searchParams;
  const c = COPY[audience];
  const mode = sp?.mode === 'sign-up' ? 'sign-up' : 'sign-in';
  const hasNext = typeof sp?.next === 'string' && sp.next.startsWith('/');
  const next = safeNext(hasNext ? sp.next : mode === 'sign-up' ? c.nextUp : c.nextIn);
  const { user } = await getSessionUser();
  if (user) redirect(next);

  return (
    <div className={`auth auth-${audience}`}>
      <div className="auth-art on-dusk" aria-hidden="true">
        <Placeholder ratio="auto" caption="" seed={audience === 'vendor' ? 5 : 2} />
        {audience === 'vendor' && <p className="label auth-art-label">For vendors</p>}
        <p className="display-1">{c.art}</p>
      </div>
      <div className="auth-panel">
        <div className="stack-lg auth-box">
          {!isSupabaseConfigured && (
            <p className="notice notice-warn" role="status">Sign-in is not connected yet. Add the Supabase URL and anon key to .env.local, then restart the app.</p>
          )}
          {sp?.error && <p className="notice notice-error" role="alert">{String(sp.error).slice(0, 200)}</p>}
          <SignInForm next={next} nextAfterSignUp={hasNext ? next : safeNext(c.nextUp)} providers={authProviders} enabled={isSupabaseConfigured} initialMode={mode} audience={audience}
            titles={{ in: c.signIn, up: c.signUp }} lede={c.lede} />
          <p className="small auth-switch">{c.other.text} <Link href={c.other.href}>{c.other.link}</Link></p>
          <p className="fine">By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link> (drafts, pending review).</p>
        </div>
      </div>
    </div>
  );
}
