'use client';

import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function redirectTo(next) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

const MIN_PASSWORD = 8;

// Email/password sign-in, verified signup and password reset. Firebase is used when configured;
// local development can continue using Supabase Auth.
export default function SignInForm({ next, nextAfterSignUp = next, providers, enabled, initialMode = 'sign-in', audience = 'planner', titles = { in: 'Sign in', up: 'Create your account' }, lede = '' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });
  const fail = (message) => setState({ status: 'error', message: /rate limit/i.test(message)
    ? 'Too many emails were sent from this sign-in service in the last hour, so it paused new ones. Wait a bit and try again, or sign in if you already have an account.'
    : message });

  async function go(supabase, to = next) {
    // Vendor door: make sure the account has the vendor role (customers keep theirs).
    if (audience === 'vendor') await supabase.rpc('add_my_role', { r: 'vendor' });
    // Full navigation so server components read the new session cookie.
    window.location.assign(to);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return fail('Enter a valid email address.');

    if (isFirebaseConfigured) {
      if (mode !== 'reset' && password.length < MIN_PASSWORD) return fail(`Use at least ${MIN_PASSWORD} characters for the password.`);
      setState({ status: 'loading', message: '' });
      try {
        const response = await fetch('/api/auth/firebase', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: mode, email: address, password, audience, next: mode === 'sign-up' ? nextAfterSignUp : next }) });
        const data = await response.json();
        if (!response.ok) return fail(data.error);
        if (data.next) return window.location.assign(data.next);
        return setState({ status: 'sent', message: data.message });
      } catch { return fail('Could not reach sign-in. Please try again.'); }
    }
    const supabase = createClient();
    if (!supabase) return;
    if (mode === 'reset') {
      setState({ status: 'loading', message: '' });
      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: redirectTo('/account/password') });
      if (error) return fail(error.message || 'Could not send the reset email. Try again in a minute.');
      return setState({ status: 'sent', message: `If ${address} has an account, a link to set a new password is on its way.` });
    }

    if (password.length < MIN_PASSWORD) return fail(`Use at least ${MIN_PASSWORD} characters for the password.`);
    setState({ status: 'loading', message: '' });

    if (mode === 'sign-up') {
      const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: redirectTo(nextAfterSignUp) } });
      if (error) return fail(/already registered|already exists/i.test(error.message) ? 'That email already has an account. Sign in instead.' : (error.message || 'Could not create the account.'));
      if (data.session) return go(supabase, nextAfterSignUp);
      // Supabase returns no identities for an address that already exists (when confirmations are on).
      if (data.user && !data.user.identities?.length) return fail('That email already has an account. Sign in instead.');
      return setState({ status: 'sent', message: `Check ${address} to confirm your account, then sign in.` });
    }

    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    if (error) return fail(/invalid login credentials/i.test(error.message) ? 'Email or password is wrong.' : /not confirmed/i.test(error.message) ? 'Confirm your email first. Check your inbox for the link.' : (error.message || 'Could not sign in.'));
    go(supabase);
  }

  async function resend() {
    if (!email.trim() || password.length < MIN_PASSWORD) return fail('Enter your email and password, then resend confirmation.');
    setState({ status: 'loading', message: '' });
    try {
      const response = await fetch('/api/auth/firebase', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend', email, password, next }) });
      const data = await response.json();
      if (!response.ok) return fail(data.error);
      setState({ status: 'sent', message: data.message });
    } catch { fail('Could not send confirmation. Please try again.'); }
  }

  async function onOAuth(provider) {
    const supabase = createClient();
    if (!supabase) return;
    setState({ status: 'loading', message: '' });
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(next) } });
    if (error) fail(error.message || 'That sign-in option is unavailable right now.');
  }

  const switchTo = (m) => { setMode(m); setState({ status: 'idle', message: '' }); };
  const busy = state.status === 'loading';
  const label = mode === 'sign-up' ? 'Create account' : mode === 'reset' ? 'Email me a reset link' : 'Sign in';

  return (
    <div className="stack-lg">
      <div className="stack">
        {audience === 'vendor' && <span className="badge badge-accent auth-kind">Vendor account</span>}
        <h1 className="display-2">{mode === 'sign-up' ? titles.up : mode === 'reset' ? 'Reset your password' : titles.in}</h1>
        {lede && <p className="muted">{lede}</p>}
      </div>
    <div className="stack">
      {mode !== 'reset' && (
        <div className="auth-tabs" role="group" aria-label="Sign in or create an account">
          <button type="button" aria-pressed={mode === 'sign-in'} onClick={() => switchTo('sign-in')}>I have an account</button>
          <button type="button" aria-pressed={mode === 'sign-up'} onClick={() => switchTo('sign-up')}>{audience === 'vendor' ? 'New vendor' : 'I’m new here'}</button>
        </div>
      )}
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required disabled={!enabled} aria-invalid={state.status === 'error' ? 'true' : undefined} />
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={MIN_PASSWORD} disabled={!enabled} aria-describedby="pw-hint" />
            <span id="pw-hint" className="hint">{mode === 'sign-up' ? `At least ${MIN_PASSWORD} characters.` : <button type="button" className="as-link" onClick={() => switchTo('reset')}>Forgot password?</button>}</span>
          </div>
        )}
        <button className="btn btn-block" type="submit" disabled={!enabled || busy}>{busy ? 'One moment…' : label}</button>
        {isFirebaseConfigured && mode === 'sign-in' && <button type="button" className="as-link small" onClick={resend} disabled={busy}>Resend confirmation</button>}
        {mode === 'reset' && <button type="button" className="as-link small" onClick={() => switchTo('sign-in')}>Back to sign in</button>}
      </form>

      {mode !== 'reset' && (!isFirebaseConfigured && (providers.google || providers.ssojet)) && <div className="or-rule">or</div>}
      {!isFirebaseConfigured && mode !== 'reset' && providers.google && (
        <button className="btn btn-outline btn-block" type="button" onClick={() => onOAuth('google')} disabled={!enabled || busy}>Continue with Google</button>
      )}
      {!isFirebaseConfigured && mode !== 'reset' && providers.ssojet && (
        <button className="btn btn-outline btn-block" type="button" onClick={() => onOAuth('custom:ssojet')} disabled={!enabled || busy}>Continue with your company (SSO)</button>
      )}

      <div aria-live="polite">
        {state.status === 'sent' && <p className="notice notice-ok">{state.message}</p>}
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.message}</p>}
      </div>
    </div>
    </div>
  );
}
