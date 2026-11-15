'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EVENT_TYPES } from '@/lib/categories';
import { money } from '@/lib/format';

const EXAMPLES = [
  'Help me plan a 150-person outdoor wedding within a $25,000 budget.',
  'What am I missing from my event plan?',
  'Where can I save money without losing the evening feel?',
];

export default function PlannerForm({ events, initialEventId, signedIn, configured }) {
  const [eventId, setEventId] = useState(initialEventId || '');
  const [prompt, setPrompt] = useState('');
  const [manual, setManual] = useState({ type: 'Wedding', date: '', location: '', guests: '', budget: '', style: '' });
  const [state, setState] = useState({ status: 'idle', plan: null, error: '', savedTo: null });
  const selected = events.find((e) => e.id === eventId);

  async function submit(e) {
    e.preventDefault();
    if (!prompt.trim()) { setState({ status: 'error', plan: null, error: 'Describe what you need first.' }); return; }
    setState({ status: 'loading', plan: null, error: '' });
    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, eventId: eventId || undefined, event: eventId ? undefined : manual }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The planner is unavailable right now.');
      setState({ status: 'done', plan: body.plan, error: '', savedTo: body.eventId });
    } catch (err) {
      setState({ status: 'error', plan: null, error: err.message });
    }
  }

  const set = (k) => (e) => setManual({ ...manual, [k]: e.target.value });
  const disabled = !configured || !signedIn;

  return (
    <div className="planner">
      <form onSubmit={submit} className="panel stack-lg planner-form" aria-describedby="planner-status">
        {events.length > 0 && (
          <div className="field">
            <label htmlFor="event">Plan for</label>
            <select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">A new idea (not saved to an event)</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            {selected && <span className="hint">Uses the saved details of “{selected.title}”. The estimate is saved to that event.</span>}
          </div>
        )}
        {!eventId && (
          <fieldset className="form-grid plain-fieldset">
            <legend className="label" style={{ gridColumn: '1 / -1' }}>Event details</legend>
            <div className="field"><label htmlFor="type">Type</label><select id="type" value={manual.type} onChange={set('type')}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" value={manual.date} onChange={set('date')} /></div>
            <div className="field"><label htmlFor="loc">Location</label><input id="loc" value={manual.location} onChange={set('location')} placeholder="City or venue" /></div>
            <div className="field"><label htmlFor="guests">Guests</label><input id="guests" inputMode="numeric" value={manual.guests} onChange={set('guests')} placeholder="150" /></div>
            <div className="field"><label htmlFor="budget">Budget (USD)</label><input id="budget" inputMode="decimal" value={manual.budget} onChange={set('budget')} placeholder="25000" /></div>
            <div className="field"><label htmlFor="style">Style</label><input id="style" value={manual.style} onChange={set('style')} placeholder="Garden, candlelit" /></div>
          </fieldset>
        )}
        <div className="field">
          <label htmlFor="prompt">What do you need?</label>
          <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} placeholder={EXAMPLES[0]} />
          <div className="chips" aria-label="Example requests">
            {EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => setPrompt(x)}>{x}</button>)}
          </div>
        </div>
        <div className="between">
          <button className="btn" type="submit" disabled={disabled || state.status === 'loading'}>{state.status === 'loading' ? 'Building your estimate…' : 'Build estimate'}</button>
          {!configured && <span className="fine">Sign-in is not connected yet, so the planner is off.</span>}
          {configured && !signedIn && <span className="fine"><Link href="/sign-in?next=/planner">Sign in</Link> to use the planner.</span>}
        </div>
      </form>

      <div id="planner-status" aria-live="polite" className="planner-result">
        {state.status === 'idle' && <PlannerEmpty />}
        {state.status === 'loading' && <div className="skeleton" aria-busy="true"><span className="sr-only">Building your estimate</span><i /><i /><i /><i /></div>}
        {state.status === 'error' && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state.status === 'done' && state.plan && <PlanResult plan={state.plan} savedTo={state.savedTo} />}
      </div>
    </div>
  );
}

function PlannerEmpty() {
  return (
    <div className="empty">
      <p className="label">What you get</p>
      <ul className="dot-list">
        <li>A budget split with low and high estimates per category</li>
        <li>Taxes, tips, delivery, setup, cleanup, and contingency as their own rows</li>
        <li>The assumptions behind every number</li>
        <li>Missing items, savings ideas, and a checklist</li>
      </ul>
    </div>
  );
}

function PlanResult({ plan, savedTo }) {
  const totals = useMemo(() => plan.categories.reduce((t, c) => ({ low: t.low + c.low, high: t.high + c.high }), { low: 0, high: 0 }), [plan]);
  const max = Math.max(1, ...plan.categories.map((c) => c.high));
  return (
    <article className="panel stack-lg">
      <div className="between"><span className="badge badge-warn">AI estimate</span>{savedTo && <Link href={`/events/${savedTo}`}>Saved to your event</Link>}</div>
      <p className="title">{plan.summary}</p>
      <div className="bars" role="table" aria-label="Estimated budget by category">
        {plan.categories.map((c) => (
          <div className="bar-row" role="row" key={c.name}>
            <span role="cell">{c.name}</span>
            <span role="cell" className="bar-track" aria-hidden="true">
              <i className="bar-fill" style={{ width: `${(c.low / max) * 100}%` }} />
              <i className="bar-fill range" style={{ left: `${(c.low / max) * 100}%`, width: `${((c.high - c.low) / max) * 100}%` }} />
            </span>
            <span role="cell" className="num">{money(c.low)} – {money(c.high)}</span>
          </div>
        ))}
      </div>
      <div className="kv"><span>Estimated total</span><b className="num">{money(totals.low)} – {money(totals.high)}</b></div>
      <div className="grid-2" style={{ gap: 'var(--s-6)' }}>
        <ListBlock title="Assumptions" items={plan.assumptions} />
        <ListBlock title="You might be missing" items={plan.missing_items} />
        <ListBlock title="Ways to save" items={plan.cost_saving_ideas} />
        <div className="stack-sm">
          <p className="label">Checklist</p>
          <ol className="dot-list">{plan.checklist.map((c, i) => <li key={i}><b>{c.task}</b> <span className="fine">{c.when}</span></li>)}</ol>
        </div>
      </div>
      <p className="fine">Generated by AI from your details and verified Vendora listings. Confirm every amount with a vendor quote.</p>
    </article>
  );
}

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return <div className="stack-sm"><p className="label">{title}</p><ul className="dot-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>;
}
