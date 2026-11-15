'use client';

import { useState } from 'react';

// Asks the AI planner to compare the ranked vendors for one category. The answer only
// refers to vendors on this page, and it is labeled as an AI suggestion.
export default function AskAdvice({ eventId, category, names }) {
  const [state, setState] = useState({ status: 'idle' });
  async function ask() {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/vendor-advice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, category }) });
      const data = await res.json();
      if (!res.ok) return setState({ status: 'error', error: data.error ?? 'The planner is unavailable right now.' });
      setState({ status: 'done', advice: data.advice });
    } catch {
      setState({ status: 'error', error: 'Could not reach the planner. Try again.' });
    }
  }
  const a = state.advice;
  return (
    <section className="panel stack advice" aria-labelledby="advice-h">
      <div className="panel-head">
        <h3 id="advice-h" className="title">Help me choose</h3>
        <button className="btn btn-sm btn-bulb" type="button" onClick={ask} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Comparing…' : a ? 'Ask again' : `Compare ${category.toLowerCase()} with AI`}
        </button>
      </div>
      {state.status === 'idle' && <p className="small muted">The planner reads these vendors’ published details and your event, then explains which fits best and what to ask before you decide.</p>}
      <div aria-live="polite">
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.error}</p>}
        {a && (
          <div className="stack">
            <div className="row"><span className="badge badge-warn">AI suggestion</span>{a.pick && names[a.pick] && <span className="badge badge-ok">Suggested: {names[a.pick]}</span>}</div>
            <p className="small">{a.summary}</p>
            {a.vendors.length > 0 && (
              <ul role="list" className="stack-sm">
                {a.vendors.map((v) => <li key={v.id} className="small"><b>{names[v.id]}</b>: {v.fit}</li>)}
              </ul>
            )}
            {a.questions.length > 0 && (
              <div className="stack-sm">
                <p className="label">Ask before you choose</p>
                <ul className="small">{a.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            )}
            <p className="fine">Generated from Vendora data only. It is not a quote and does not confirm availability.</p>
          </div>
        )}
      </div>
    </section>
  );
}
