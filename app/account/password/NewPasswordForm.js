'use client';

import { isFirebaseConfigured } from '@/lib/firebase/config';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function NewPasswordForm() {
  const [pw, setPw] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });
  async function onSubmit(e) {
    e.preventDefault();
    if (pw.length < 8) { setState({ status: 'error', message: 'Use at least 8 characters.' }); return; }
    if (isFirebaseConfigured) {
      setState({ status: 'loading', message: '' });
      try {
        const response = await fetch('/api/auth/firebase/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
        const data = await response.json();
        if (!response.ok) { setState({ status: 'error', message: data.error }); return; }
        setPw(''); setState({ status: 'ok', message: 'Password updated. Please sign in again.' });
        window.location.assign('/sign-in');
      } catch { setState({ status: 'error', message: 'Could not change your password. Try again.' }); }
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setState({ status: 'loading', message: '' });
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setState({ status: 'error', message: error.message || 'Could not change the password.' });
    else { setPw(''); setState({ status: 'ok', message: 'Password updated.' }); }
  }
  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <div className="field"><label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="np-hint" />
        <span id="np-hint" className="hint">At least 8 characters.</span></div>
      <div className="row"><button className="btn" type="submit" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Saving…' : 'Save password'}</button></div>
      <div aria-live="polite">
        {state.status === 'ok' && <p className="notice notice-ok">{state.message}</p>}
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.message}</p>}
      </div>
    </form>
  );
}
