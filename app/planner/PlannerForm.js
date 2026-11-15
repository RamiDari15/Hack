'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EVENT_TYPE_GROUPS } from '@/lib/categories';
import { money } from '@/lib/format';

const EXAMPLES = [
  'Keep it relaxed, family-style dinner, and a dance floor.',
  'What am I missing from my event plan?',
  'Where can I save money without losing the evening feel?',
];
const STYLES = ['Elegant', 'Rustic', 'Modern', 'Garden', 'Boho', 'Classic', 'Casual', 'Glam', 'Candlelit'];
const PRIORITIES = ['Food and drink', 'Venue', 'Photos and video', 'Music and dancing', 'Flowers and decor', 'Guest comfort'];
const SETTINGS = [{ v: 'indoor', l: 'Indoor' }, { v: 'outdoor', l: 'Outdoor' }, { v: 'both', l: 'Both' }];
const digits = (v) => String(v ?? '').replace(/[^0-9]/g, '');
const withCommas = (v) => (digits(v) ? Number(digits(v)).toLocaleString('en-US') : '');
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Toggles({ legend, options, value, onChange, max, hint }) {
  const toggle = (o) => {
    if (value.includes(o)) onChange(value.filter((x) => x !== o));
    else if (!max || value.length < max) onChange([...value, o]);
  };
  return (
    <fieldset className="plain-fieldset stack-sm">
      <legend className="field-label">{legend}</legend>
      {hint && <span className="hint">{hint}</span>}
      <div className="chips toggle-chips">
        {options.map((o) => (
          <button key={o} type="button" className="chip" aria-pressed={value.includes(o)} onClick={() => toggle(o)}
            disabled={Boolean(max) && value.length >= max && !value.includes(o)}>{o}</button>
        ))}
      </div>
    </fieldset>
  );
}

export default function PlannerForm({ events, initialEventId, signedIn, configured }) {
  const [eventId, setEventId] = useState(initialEventId || '');
  const [prompt, setPrompt] = useState('');
  const [manual, setManual] = useState({ type: 'Wedding', date: '', location: '', guests: '', budget: '' });
  const [styles, setStyles] = useState([]);
  const [otherStyle, setOtherStyle] = useState('');
  const [setting, setSetting] = useState('');
  const [hours, setHours] = useState('5');
  const [priorities, setPriorities] = useState([]);
  const [state, setState] = useState({ status: 'idle', plan: null, error: '', savedTo: null });
  const selected = events.find((e) => e.id === eventId);

  const guests = selected ? selected.guest_count : Number(digits(manual.guests)) || null;
  const budget = selected ? (selected.budget_cents == null ? null : selected.budget_cents / 100) : Number(digits(manual.budget)) || null;
  const perGuest = guests && budget ? Math.round(budget / guests) : null;
  const style = [...styles, otherStyle.trim()].filter(Boolean).join(', ');
  const using = selected
    ? [selected.event_type, fmtDate(selected.event_date), selected.location, selected.guest_count && `${selected.guest_count} guests`, budget && money(budget)]
    : [manual.type, fmtDate(manual.date), manual.location.trim(), guests && `${guests.toLocaleString('en-US')} guests`, budget && money(budget)];

  function check() {
    if (selected) return '';
    if (manual.guests && (!guests || guests > 5000)) return 'Enter a guest count between 1 and 5,000.';
    if (manual.budget && !budget) return 'Enter the budget as a dollar amount.';
    if (!manual.location.trim() && !prompt.trim()) return 'Add a location (or describe the event below) so prices match your area.';
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    const problem = check();
    if (problem) { setState({ status: 'error', plan: null, error: problem }); return; }
    setState({ status: 'loading', plan: null, error: '' });
    const details = { setting, hours: Number(hours), priorities };
    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, eventId: eventId || undefined,
          event: eventId ? details : { ...manual, guests: digits(manual.guests), budget: digits(manual.budget), style, ...details },
        }),
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
      <form onSubmit={submit} className="panel stack-lg planner-form" aria-describedby="planner-status" noValidate>
        {events.length > 0 && (
          <div className="field">
            <label htmlFor="event">Plan for</label>
            <select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">A new idea (not saved to an event)</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            {selected && <span className="hint">Uses “{selected.title}” and saves the plan to it. <Link href={`/events/${selected.id}`}>Edit those details</Link></span>}
          </div>
        )}
        {!eventId && (
          <fieldset className="form-grid plain-fieldset">
            <legend className="label" style={{ gridColumn: '1 / -1' }}>1. The basics</legend>
            <div className="field"><label htmlFor="type">Type</label><select id="type" value={manual.type} onChange={set('type')}>{EVENT_TYPE_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.types.map((t) => <option key={t}>{t}</option>)}</optgroup>)}</select></div>
            <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" value={manual.date} onChange={set('date')} /></div>
            <div className="field"><label htmlFor="loc">Location</label><input id="loc" value={manual.location} onChange={set('location')} placeholder="Ann Arbor, MI" autoComplete="address-level2" /></div>
            <div className="field"><label htmlFor="guests">Guests</label><input id="guests" inputMode="numeric" value={manual.guests} onChange={(e) => setManual({ ...manual, guests: withCommas(e.target.value) })} placeholder="150" /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="budget">Total budget</label>
              <div className="input-affix"><span aria-hidden="true">$</span><input id="budget" inputMode="numeric" value={manual.budget} onChange={(e) => setManual({ ...manual, budget: withCommas(e.target.value) })} placeholder="25,000" aria-describedby="budget-hint" /></div>
              <span id="budget-hint" className="hint">{perGuest ? `About ${money(perGuest)} per guest.` : 'Leave empty to see a typical range for your event.'}</span></div>
          </fieldset>
        )}
        <fieldset className="plain-fieldset stack">
          <legend className="label">{eventId ? 'Shape the plan' : '2. The feel'}</legend>
          <div className="form-grid">
            <fieldset className="plain-fieldset stack-sm">
              <legend className="field-label">Setting</legend>
              <div className="seg-pills" role="radiogroup" aria-label="Setting">
                {SETTINGS.map((x) => <label key={x.v}><input type="radio" name="setting" value={x.v} checked={setting === x.v} onChange={() => setSetting(x.v)} /><span>{x.l}</span></label>)}
              </div>
            </fieldset>
            <div className="field"><label htmlFor="hours">Length</label>
              <select id="hours" value={hours} onChange={(e) => setHours(e.target.value)}>{[2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></div>
          </div>
          {!eventId && <Toggles legend="Style" options={STYLES} value={styles} onChange={setStyles} hint="Pick any that fit." />}
          {!eventId && <div className="field"><label htmlFor="style-other">Other style (optional)</label><input id="style-other" value={otherStyle} onChange={(e) => setOtherStyle(e.target.value)} maxLength={80} placeholder="Lantern-lit courtyard" /></div>}
          <Toggles legend="Where should the money go first?" options={PRIORITIES} value={priorities} onChange={setPriorities} max={3} hint="Up to 3. These get more of the budget." />
        </fieldset>
        <div className="field">
          <label htmlFor="prompt">{eventId ? 'Anything else?' : '3. Anything else?'} <span className="fine">(optional)</span></label>
          <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} rows={3} placeholder={EXAMPLES[0]} />
          <div className="chips" aria-label="Example requests">
            {EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => setPrompt(x)}>{x}</button>)}
          </div>
        </div>
        <p className="planner-using small"><b>Planning for:</b> {using.filter(Boolean).join(' · ') || 'your description'}{setting ? ` · ${setting}` : ''} · {hours} hours{style && !eventId ? ` · ${style}` : ''}{priorities.length ? ` · priorities: ${priorities.join(', ')}` : ''}</p>
        <div className="between">
          <button className="btn" type="submit" disabled={disabled || state.status === 'loading'}>{state.status === 'loading' ? 'Building your plan…' : 'Build my plan'}</button>
          {!configured && <span className="fine">Sign-in is not connected yet, so the planner is off.</span>}
          {configured && !signedIn && <span className="fine"><Link href="/sign-in?next=/planner">Sign in</Link> to use the planner.</span>}
        </div>
      </form>

      <div id="planner-status" aria-live="polite" className="planner-result">
        {state.status === 'idle' && <PlannerEmpty />}
        {state.status === 'loading' && <div className="skeleton" aria-busy="true"><span className="sr-only">Building your plan</span><i /><i /><i /><i /></div>}
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
        <li>A budget split with a low and high ballpark per category</li>
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
      <div className="between"><span className="badge badge-warn">AI ballpark</span>{savedTo && <Link href={`/events/${savedTo}`}>Saved to your event</Link>}</div>
      <p className="title">{plan.summary}</p>
      <div className="bars" role="table" aria-label="Budget ballpark by category">
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
      <div className="kv"><span>Ballpark total</span><b className="num">{money(totals.low)} – {money(totals.high)}</b></div>
      {plan.budget_fit && <BudgetFit fit={plan.budget_fit} />}
      {plan.recommendations?.length > 0 && (
        <section className="stack-sm" aria-labelledby="recs-h">
          <h3 id="recs-h" className="title">Recommended for this event</h3>
          <ul role="list" className="rec-list">
            {plan.recommendations.map((r) => (
              <li key={r.vendor_id}>
                <div className="between"><span className="fine">{r.category}</span><span className={`badge ${r.verified ? 'badge-ok' : 'badge-plain'}`}>{r.verified ? 'Verified' : 'Public listing'}</span></div>
                <Link className="title" href={`/vendors/${r.vendor_id}`}>{r.vendor_name}</Link>
                <p className="small">{r.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid-2" style={{ gap: 'var(--s-6)' }}>
        <ListBlock title="Assumptions" items={plan.assumptions} />
        <ListBlock title="You might be missing" items={plan.missing_items} />
        <ListBlock title="Ways to save" items={plan.cost_saving_ideas} />
        <div className="stack-sm">
          <p className="label">Checklist</p>
          <ol className="dot-list">{plan.checklist.map((c, i) => <li key={i}><b>{c.task}</b> <span className="fine">{c.when}</span></li>)}</ol>
        </div>
      </div>
      
    </article>
  );
}

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return <div className="stack-sm"><p className="label">{title}</p><ul className="dot-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>;
}

function BudgetFit({ fit }) {
  const mid = Math.round((fit.low + fit.high) / 2);
  const left = fit.budget - mid;
  const tone = fit.high > fit.budget ? 'notice-warn' : fit.mid_share < 80 ? 'notice-info' : 'notice-ok';
  return (
    <div className={`notice ${tone} budget-fit`}>
      <p className="small"><b>Against your {money(fit.budget)} budget:</b> the middle of this plan is {money(mid)}, about {fit.mid_share}% of it{left >= 0 ? `, leaving ${money(left)}` : `, ${money(-left)} over`}.</p>
      {fit.mid_share < 80 && <p className="fine">That’s well under your budget. Tell the planner where you’d like to splurge.</p>}
      {fit.high > fit.budget && <p className="fine">The high end goes over budget. See “Ways to save” below.</p>}
    </div>
  );
}
