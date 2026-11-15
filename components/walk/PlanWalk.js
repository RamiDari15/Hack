'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Walk from './Walk';
import { matchCategory } from './stations';
import { savePlanVendor, shortlistPlanVendor } from '@/app/actions/plan';

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

// The planner walkthrough: one stop per budget line of the plan, showing the ballpark the plan set aside
// and the listed businesses it suggested for that line. Saving or shortlisting always takes a click.
export default function PlanWalk({ plan, events = [], eventId = null, signedIn = true }) {
  const [target, setTarget] = useState(eventId ?? events[0]?.id ?? '');
  const [done, setDone] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [, start] = useTransition();

  // Vendor lines become stops; taxes, tips and the like stay in the overview as plain costs.
  const vendorLines = plan.categories.filter((c) => matchCategory(c.name));
  const lines = vendorLines.length >= 2 ? vendorLines : plan.categories;
  const other = plan.categories.filter((c) => !lines.includes(c));
  const stops = useMemo(() => lines.slice(0, 10).map((c) => {
    const model = matchCategory(c.name);
    const recs = (plan.recommendations ?? []).filter((r) => r.category === model || r.category === c.name);
    const count = recs.filter((r) => done[`list:${r.vendor_id}`] || done[`save:${r.vendor_id}`]).length;
    return { category: c.name, model, low: c.low, high: c.high, notes: c.notes, recs, filled: count > 0, count };
  }), [plan, done]);

  const act = (kind, r) => {
    setBusy(`${kind}:${r.vendor_id}`); setNote('');
    start(async () => {
      const res = kind === 'save' ? await savePlanVendor(r.vendor_id) : await shortlistPlanVendor(target, r.vendor_id);
      setBusy('');
      if (res?.error) { setNote(res.error); return; }
      setDone((d) => ({ ...d, [`${kind}:${r.vendor_id}`]: true }));
      const ev = events.find((e) => e.id === target)?.title ?? 'the event';
      setNote(kind === 'save' ? `Saved ${r.vendor_name} to your account.` : `Added ${r.vendor_name} to the shortlist for ${ev}.`);
    });
  };

  const picker = signedIn && events.length > 0 && (
    <div className="walk-target">
      <label htmlFor="walk-target" className="label">Shortlist for</label>
      <select id="walk-target" className="input-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
    </div>
  );

  const detail = (s) => (
    <div className="walk-detail">
      <h2 className="walk-h">{s.category}</h2>
      <p className="walk-sub">The plan sets aside {money(s.low)} – {money(s.high)} here.</p>
      {s.notes && <p className="walk-notes">{s.notes}</p>}

      <div className="walk-group">
        <h3>Worth a call</h3>
        {s.recs.length ? (
          <ul role="list" className="walk-list walk-list-recs">
            {s.recs.map((r) => {
              const saved = done[`save:${r.vendor_id}`], listed = done[`list:${r.vendor_id}`];
              return (
                <li key={r.vendor_id}>
                  <span className="walk-name">
                    <Link href={`/vendors/${r.vendor_id}`}>{r.vendor_name}</Link>
                    <small>{[r.verified ? 'Verified' : 'Listed', r.city].filter(Boolean).join(' · ')}</small>
                    {r.why && <span className="walk-why">{r.why}</span>}
                  </span>
                  {signedIn && (
                    <span className="walk-acts">
                      <button type="button" className="btn btn-sm btn-outline" disabled={saved || busy === `save:${r.vendor_id}`} onClick={() => act('save', r)}>{saved ? 'Saved' : 'Save'}</button>
                      {target && <button type="button" className="btn btn-sm" disabled={listed || busy === `list:${r.vendor_id}`} onClick={() => act('list', r)}>{listed ? 'Shortlisted' : busy === `list:${r.vendor_id}` ? 'Adding…' : 'Shortlist'}</button>}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="walk-empty">The plan didn’t name anyone for this yet.</p>}
        {s.model && <Link className="walk-more" href={`/vendors?category=${encodeURIComponent(s.model)}${target ? `&event=${target}` : ''}`}>Browse all {s.model.toLowerCase()} →</Link>}
      </div>
      {picker}
      {signedIn && !events.length && <p className="walk-empty">Create an event to shortlist vendors for it. <Link href="/events/new">New event →</Link></p>}
      <p className="walk-note" role="status">{note}</p>
    </div>
  );

  const overview = ({ start: begin, total, pick }) => (
    <div className="walk-detail">
      <h2 className="walk-h">Walk through this plan</h2>
      <p className="walk-sub">{total} stops, one for each vendor in the budget. {stops.filter((s) => s.recs.length).length} have a business the plan suggested.</p>
      <button type="button" className="btn btn-bulb" onClick={begin}>Start the walk →</button>
      <ul role="list" className="walk-index">
        {stops.map((s, i) => (
          <li key={s.category}>
            <button type="button" onClick={() => pick(i)}>
              <span>{s.category}</span><b className={s.filled ? 'is-on' : undefined}>{money((s.low + s.high) / 2)}</b>
            </button>
          </li>
        ))}
      </ul>
      {other.length > 0 && <p className="walk-notes">Also in the plan: {other.map((c) => `${c.name} ${money((c.low + c.high) / 2)}`).join(', ')}.</p>}
      {picker}
      <p className="walk-note" role="status">{note}</p>
    </div>
  );

  return <Walk stops={stops} renderDetail={detail} renderOverview={overview} label="Walkthrough of your plan" />;
}
