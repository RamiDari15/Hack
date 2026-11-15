'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function redirectTo(next) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

export default function SignInForm({ next, providers, enabled }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function onEmail(e) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) { setState({ status: 'error', message: 'Enter a valid email address.' }); return; }
    setState({ status: 'loading', message: '' });
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(next) } });
    if (error) setState({ status: 'error', message: error.message || 'Could not send the link. Try again in a minute.' });
    else setState({ status: 'sent', message: `Check ${email} for a sign-in link. It expires after a short time.` });
  }

  async function onOAuth(provider) {
    const supabase = createClient();
    if (!supabase) return;
    setState({ status: 'loading', message: '' });
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(next) } });
    if (error) setState({ status: 'error', message: error.message || 'That sign-in option is unavailable right now.' });
  }

  const busy = state.status === 'loading';
  return (
    <div className="stack">
      <form className="stack" onSubmit={onEmail} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required disabled={!enabled} aria-invalid={state.status === 'error' ? 'true' : undefined} aria-describedby="email-hint" />
          <span id="email-hint" className="hint">We email you a one-time link. No password needed.</span>
        </div>
        <button className="btn btn-block" type="submit" disabled={!enabled || busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
      </form>

      {(providers.google || providers.ssojet) && <div className="or-rule">or</div>}
      {providers.google && (
        <button className="btn btn-outline btn-block" type="button" onClick={() => onOAuth('google')} disabled={!enabled || busy}>Continue with Google</button>
      )}
      {providers.ssojet && (
        <button className="btn btn-outline btn-block" type="button" onClick={() => onOAuth('custom:ssojet')} disabled={!enabled || busy}>Continue with your company (SSO)</button>
      )}

      <div aria-live="polite">
        {state.status === 'sent' && <p className="notice notice-ok">{state.message}</p>}
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.message}</p>}
      </div>
    </div>
  );
}
