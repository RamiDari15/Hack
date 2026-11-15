'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// "Draft with AI" and "Print" for the day-of timeline.
export default function TimelineTools({ eventId, hasAi, canDraft }) {
  const router = useRouter();
  const [state, setState] = useState({ status: 'idle' });
  async function draft() {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId }) });
      const data = await res.json();
      if (!res.ok) return setState({ status: 'error', error: data.error ?? 'The planner is unavailable right now.' });
      setState({ status: 'done', message: `Drafted ${data.count} items. Check every time with your vendors.` });
      router.refresh();
    } catch {
      setState({ status: 'error', error: 'Could not reach the planner. Try again.' });
    }
  }
  return (
    <div className="stack-sm no-print">
      <div className="row">
        {canDraft && (
          <button type="button" className="btn btn-sm btn-bulb" onClick={draft} disabled={state.status === 'loading'}>
            {state.status === 'loading' ? 'Drafting…' : hasAi ? 'Redraft with AI' : 'Draft with AI'}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-outline" onClick={() => window.print()}>Print run sheet</button>
      </div>
      <div aria-live="polite">
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state.status === 'done' && <p className="notice notice-ok">{state.message}</p>}
      </div>
    </div>
  );
}
