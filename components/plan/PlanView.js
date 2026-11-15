'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { addPlanItems, savePlanVendor, shortlistPlanVendor } from '@/app/actions/plan';

// An AI plan as a working tool: facts up top, the budget bars, then lists you can act on.
// Every action needs a click; nothing is added to an event or a to-do list on its own.
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const minusWeeks = (iso, w) => {
  if (!iso || w == null) return '';
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - w * 7);
  return d.toISOString().slice(0, 10);
};

export default function PlanView({ plan, planId = null, eventId = null, events = [], signedIn = true }) {
  const facts = plan.facts ?? {};
  const linked = events.find((e) => e.id === eventId);
  const eventDate = linked?.event_date || facts.date || '';
  const totals = useMemo(() => plan.categories.reduce((t, c) => ({ low: t.low + c.low, high: t.high + c.high }), { low: 0, high: 0 }), [plan]);
  const max = Math.max(1, ...plan.categories.map((c) => c.high));
  // Short lists only: the few items worth acting on.
  const missing = (plan.missing_items ?? []).slice(0, 6);
  const savings = (plan.cost_saving_ideas ?? []).slice(0, 3);

  // Where "Add" sends things. Default: the plan's event (and your to-dos) if there is one.
  const [dest, setDest] = useState(eventId ? `both:${eventId}` : 'todos');
  const [flash, setFlash] = useState('');
  const [pending, start] = useTransition();
  const destEvent = dest.includes(':') ? dest.split(':')[1] : null;
  const destName = dest === 'todos' ? 'your to-dos' : `${dest.startsWith('both') ? 'your to-dos and ' : ''}${events.find((e) => e.id === destEvent)?.title ?? 'the event'}`;

  const send = (items, after) => start(async () => {
    const res = await addPlanItems({ items, toTodos: dest === 'todos' || dest.startsWith('both'), eventId: destEvent });
    if (res?.error) { setFlash(res.error); return; }
    const parts = [res.todos ? `${res.todos} to your to-dos` : '', res.tasks ? `${res.tasks} to the event` : ''].filter(Boolean);
    setFlash(parts.length ? `Added ${parts.join(' and ')}.` : 'Already on the event.');
    after?.();
  });

  // Editable timeline, seeded from the plan's checklist.
  const [steps, setSteps] = useState(() => (plan.checklist ?? []).map((c, i) => ({
    key: `s${i}`, title: c.task, when: c.when, due: minusWeeks(eventDate, c.weeks_before), on: true, done: false,
  })));
  const edit = (key, patch) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const picked = steps.filter((s) => s.on && !s.done && s.title.trim());

  const [addedMissing, setAddedMissing] = useState({});
  const [addedSave, setAddedSave] = useState({});

  return (
    <article className="plan stack-lg" aria-labelledby="plan-h">
      <header className="plan-head">
        <div className="between">
          <span className="badge badge-warn">AI ballpark</span>
          <span className="small">
            {planId && <Link href={`/plans/${planId}`}>Saved to your account</Link>}
            {eventId && <> · <Link href={`/events/${eventId}`}>Open the event</Link></>}
          </span>
        </div>
        <h2 id="plan-h" className="plan-title">Your plan{facts.type ? <>, <em>{facts.type.toLowerCase()}</em></> : ''}</h2>
        <ul className="fact-chips" role="list">
          {facts.date && <li>{fmtDate(facts.date)}</li>}
          {facts.location && <li>{facts.location}</li>}
          {facts.guests && <li>{facts.guests.toLocaleString('en-US')} guests</li>}
          {facts.budget && <li>{money(facts.budget)} budget{facts.per_guest ? ` · ${money(facts.per_guest)}/guest` : ''}</li>}
          {facts.setting && <li>{facts.setting[0].toUpperCase() + facts.setting.slice(1)}</li>}
          {facts.hours && <li>{facts.hours} hours</li>}
        </ul>
        {plan.summary && <p className="plan-summary">{plan.summary}</p>}
      </header>

      <section className="plan-card" aria-labelledby="budget-h">
        <div className="between"><h3 id="budget-h" className="plan-h3">Where the money goes</h3><b className="num plan-total">{money(totals.low)} – {money(totals.high)}</b></div>
        <div className="bars" role="table" aria-label="Budget ballpark by category">
          {plan.categories.map((c) => (
            <div className="bar-row" role="row" key={c.name} title={c.notes || undefined}>
              <span role="cell">{c.name}</span>
              <span role="cell" className="bar-track" aria-hidden="true">
                <i className="bar-fill" style={{ width: `${(c.low / max) * 100}%` }} />
                <i className="bar-fill range" style={{ left: `${(c.low / max) * 100}%`, width: `${((c.high - c.low) / max) * 100}%` }} />
              </span>
              <span role="cell" className="num">{money(c.low)} – {money(c.high)}</span>
            </div>
          ))}
        </div>
        {plan.budget_fit && <BudgetFit fit={plan.budget_fit} />}
      </section>

      {signedIn && (
        <div className="plan-dest" role="group" aria-label="Where to add things">
          <label htmlFor="plan-dest" className="label">Add things to</label>
          <select id="plan-dest" className="input-sm" value={dest} onChange={(e) => setDest(e.target.value)}>
            <option value="todos">My to-dos</option>
            {events.map((e) => <option key={`b${e.id}`} value={`both:${e.id}`}>My to-dos + {e.title}</option>)}
            {events.map((e) => <option key={`e${e.id}`} value={`event:${e.id}`}>{e.title} only</option>)}
          </select>
          <span className="plan-flash small" role="status" aria-live="polite">{pending ? 'Adding…' : flash}</span>
        </div>
      )}

      {plan.recommendations?.length > 0 && (
        <section className="stack-sm" aria-labelledby="recs-h">
          <h3 id="recs-h" className="plan-h3">Worth a call</h3>
          <ul role="list" className="rec-list">
            {plan.recommendations.map((r) => <RecCard key={r.vendor_id} r={r} eventId={destEvent} signedIn={signedIn} />)}
          </ul>
        </section>
      )}

      <section className="plan-card" aria-labelledby="steps-h">
        <div className="between">
          <h3 id="steps-h" className="plan-h3">Your timeline</h3>
          <span className="fine">{eventDate ? `Dates count back from ${fmtDate(eventDate)}` : 'Add a date to the event to get due dates'}</span>
        </div>
        <ol className="step-edit" role="list">
          {steps.map((s) => (
            <li key={s.key} className={s.done ? 'is-added' : undefined}>
              <input type="checkbox" checked={s.on} disabled={s.done} onChange={(e) => edit(s.key, { on: e.target.checked })} aria-label={`Include “${s.title}”`} />
              <input className="step-title" value={s.title} disabled={s.done} onChange={(e) => edit(s.key, { title: e.target.value })} aria-label="Step" maxLength={200} />
              <input className="step-due" type="date" value={s.due} disabled={s.done} onChange={(e) => edit(s.key, { due: e.target.value })} aria-label={`Due date for “${s.title}”`} />
              {s.done ? <span className="step-ok">Added</span>
                : <button type="button" className="step-x" onClick={() => setSteps((x) => x.filter((y) => y.key !== s.key))} aria-label={`Remove “${s.title}”`}>×</button>}
              {s.when && !s.due && <span className="fine step-when">{s.when}</span>}
            </li>
          ))}
        </ol>
        <div className="row">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSteps((x) => [...x, { key: `n${Date.now()}`, title: '', when: '', due: '', on: true, done: false }])}>+ Add a step</button>
          {signedIn && <button type="button" className="btn btn-sm btn-bulb" disabled={!picked.length || pending}
            onClick={() => send(picked.map((s) => ({ title: s.title, due: s.due, when: s.when })), () => setSteps((x) => x.map((y) => (y.on && y.title.trim() ? { ...y, done: true } : y))))}>
            Add {picked.length} to {destName}
          </button>}
        </div>
      </section>

      <div className="plan-cols">
        {missing.length > 0 && (
          <section className="plan-card" aria-labelledby="miss-h">
            <div className="between">
              <h3 id="miss-h" className="plan-h3">Easy to forget</h3>
              {signedIn && <button type="button" className="as-link small" disabled={pending}
                onClick={() => send(missing.filter((m) => !addedMissing[m]).map((m) => ({ title: m })), () => setAddedMissing(Object.fromEntries(missing.map((m) => [m, true]))))}>Add all</button>}
            </div>
            <ul className="act-list" role="list">
              {missing.map((m) => (
                <li key={m}>
                  <span>{m}</span>
                  {signedIn && (addedMissing[m] ? <span className="step-ok">Added</span>
                    : <button type="button" className="act-add" disabled={pending} onClick={() => send([{ title: m }], () => setAddedMissing((a) => ({ ...a, [m]: true })))} aria-label={`Add “${m}” to ${destName}`}>+</button>)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {savings.length > 0 && (
          <section className="plan-card plan-card-sun" aria-labelledby="save-h">
            <h3 id="save-h" className="plan-h3">Ways to save</h3>
            <ul className="act-list" role="list">
              {savings.map((m) => (
                <li key={m}>
                  <span>{m}</span>
                  {signedIn && (addedSave[m] ? <span className="step-ok">On your list</span>
                    : <button type="button" className="btn btn-sm btn-ghost act-try" disabled={pending} onClick={() => send([{ title: `Try: ${m}` }], () => setAddedSave((a) => ({ ...a, [m]: true })))}>Try it</button>)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

    </article>
  );
}

function RecCard({ r, eventId, signedIn }) {
  const [saved, setSaved] = useState(false);
  const [listed, setListed] = useState('');
  const [pending, start] = useTransition();
  return (
    <li className="rec-card">
      <div className="between"><span className="fine">{r.category}{r.city ? ` · ${r.city}` : ''}</span><span className={`badge badge-sm ${r.verified ? 'badge-ok' : 'badge-plain'}`}>{r.verified ? 'Verified' : 'Listed'}</span></div>
      <Link className="rec-name" href={`/vendors/${r.vendor_id}`}>{r.vendor_name}</Link>
      <p className="small muted">{r.why}</p>
      {signedIn && (
        <div className="row rec-actions">
          <button type="button" className={`btn btn-sm save-btn${saved ? ' is-saved' : ''}`} disabled={pending || saved}
            onClick={() => start(async () => { const x = await savePlanVendor(r.vendor_id); if (!x?.error) setSaved(true); })}>
            <span aria-hidden="true">{saved ? '♥' : '♡'}</span> {saved ? 'Saved' : 'Save'}
          </button>
          {eventId && <button type="button" className="btn btn-sm btn-ghost" disabled={pending || listed === 'ok'}
            onClick={() => start(async () => { const x = await shortlistPlanVendor(eventId, r.vendor_id); setListed(x?.error ? x.error : 'ok'); })}>
            {listed === 'ok' ? 'On the shortlist' : '+ Shortlist'}
          </button>}
          {listed && listed !== 'ok' && <span className="error">{listed}</span>}
        </div>
      )}
    </li>
  );
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
