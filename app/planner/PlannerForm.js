'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import PlanView from '@/components/plan/PlanView';
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
      setState({ status: 'done', plan: body.plan, error: '', savedTo: body.eventId, planId: body.planId });
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
            <legend className="form-step" style={{ gridColumn: '1 / -1' }}><i>1</i>The basics</legend>
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
          <legend className="form-step">{eventId ? 'Shape the plan' : <><i>2</i>The feel</>}</legend>
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
        <div className="field form-section">
          <p className="form-step" aria-hidden="true">{eventId ? 'Anything else?' : <><i>3</i>Anything else?</>}</p>
          <label htmlFor="prompt">Tell it anything else <span className="fine">(optional)</span></label>
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
        {state.status === 'done' && state.plan && <PlanView plan={state.plan} planId={state.planId} eventId={state.savedTo} events={events} signedIn={signedIn} />}
      </div>
    </div>
  );
}

function PlannerEmpty() {
  return (
    <div className="empty">
      <h2 className="empty-title">What you get</h2>
      <ul className="dot-list">
        <li>Your budget split by category, with a low and high ballpark for each</li>
        <li>Tips, delivery, setup and cleanup as their own rows</li>
        <li>Listed vendors near you that fit each category</li>
        <li>A timeline you can edit and add to your to-dos</li>
      </ul>
    </div>
  );
}

