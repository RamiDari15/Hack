'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import Walk from './Walk';
import { walkAddVendor, walkRemoveVendor } from '@/app/actions/walk';

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const STATUS = { inquiry: 'Asked', quote: 'Quote in', hold: 'On hold', confirmed: 'Booked' };

// The event walkthrough: each stop lists who is booked or contacted, who is on the shortlist (remove),
// and a few listed businesses in that category (add). Changes save to the event's shortlist straight away.
export default function EventWalk({ event, categories, picked: initialPicked, booked, suggestions, ballpark }) {
  const [picked, setPicked] = useState(initialPicked);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [, start] = useTransition();

  const stops = useMemo(() => categories.map((c) => {
    const count = picked.filter((p) => p.category === c).length + booked.filter((b) => b.category === c).length;
    return { category: c, filled: count > 0, count };
  }), [categories, picked, booked]);

  const add = (v, category) => {
    setBusy(v.id); setNote('');
    start(async () => {
      const res = await walkAddVendor(event.id, v.id);
      setBusy('');
      if (res?.error) { setNote(res.error); return; }
      setPicked((p) => (p.some((x) => x.id === v.id) ? p : [...p, { ...v, category, shortlistId: res.id }]));
      setNote(res.already ? `${v.name} was already on the shortlist.` : `Added ${v.name}.`);
    });
  };
  const remove = (v) => {
    setBusy(v.id); setNote('');
    start(async () => {
      const res = await walkRemoveVendor(event.id, v.shortlistId);
      setBusy('');
      if (res?.error) { setNote(res.error); return; }
      setPicked((p) => p.filter((x) => x.shortlistId !== v.shortlistId));
      setNote(`Removed ${v.name}.`);
    });
  };

  const detail = (stop) => {
    const c = stop.category;
    const mine = picked.filter((p) => p.category === c);
    const theirs = booked.filter((b) => b.category === c);
    const ideas = (suggestions[c] ?? []).filter((s) => !mine.some((m) => m.id === s.id) && !theirs.some((b) => b.id === s.id)).slice(0, 4);
    const bp = ballpark[c];
    return (
      <div className="walk-detail">
        <h2 className="walk-h">{c}</h2>
        {bp && <p className="walk-sub">Your plan sets aside {money(bp.low)} – {money(bp.high)} here.</p>}

        {theirs.length > 0 && (
          <div className="walk-group">
            <h3>In touch</h3>
            <ul role="list" className="walk-list">
              {theirs.map((b) => (
                <li key={b.bookingId}>
                  <span className="walk-name"><Link href={`/bookings/${b.bookingId}`}>{b.name}</Link><small>{STATUS[b.status] ?? b.status}{b.city ? ` · ${b.city}` : ''}</small></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="walk-group">
          <h3>On your shortlist</h3>
          {mine.length ? (
            <ul role="list" className="walk-list">
              {mine.map((v) => (
                <li key={v.shortlistId}>
                  <span className="walk-name"><Link href={`/vendors/${v.id}?event=${event.id}`}>{v.name}</Link><small>{[v.verified ? 'Verified' : null, v.city].filter(Boolean).join(' · ')}</small></span>
                  <button type="button" className="btn btn-sm btn-outline" disabled={busy === v.id} onClick={() => remove(v)}>{busy === v.id ? 'Removing…' : 'Remove'}</button>
                </li>
              ))}
            </ul>
          ) : <p className="walk-empty">Nobody here yet.</p>}
        </div>

        <div className="walk-group">
          <h3>Add someone</h3>
          {ideas.length ? (
            <ul role="list" className="walk-list">
              {ideas.map((v) => (
                <li key={v.id}>
                  <span className="walk-name"><Link href={`/vendors/${v.id}?event=${event.id}`}>{v.name}</Link><small>{[v.verified ? 'Verified' : null, v.city].filter(Boolean).join(' · ')}</small></span>
                  <button type="button" className="btn btn-sm" disabled={busy === v.id} onClick={() => add(v, c)}>{busy === v.id ? 'Adding…' : 'Add'}</button>
                </li>
              ))}
            </ul>
          ) : <p className="walk-empty">No more listed {c.toLowerCase()} nearby.</p>}
          <Link className="walk-more" href={`/vendors?category=${encodeURIComponent(c)}&event=${event.id}`}>Browse all {c.toLowerCase()} →</Link>
        </div>
        <p className="walk-note" role="status">{note}</p>
      </div>
    );
  };

  const overview = ({ start: begin, filled, total, pick }) => (
    <div className="walk-detail">
      <h2 className="walk-h">{event.title}</h2>
      <p className="walk-sub">{filled} of {total} stops have someone. Walk the room to fill the rest.</p>
      <button type="button" className="btn btn-bulb" onClick={begin}>Start the walk →</button>
      <ul role="list" className="walk-index">
        {stops.map((s, i) => (
          <li key={s.category}>
            <button type="button" onClick={() => pick(i)}>
              <span>{s.category}</span><b className={s.filled ? 'is-on' : undefined}>{s.count ? `${s.count}` : '—'}</b>
            </button>
          </li>
        ))}
      </ul>
      <p className="walk-note" role="status">{note}</p>
    </div>
  );

  return <Walk stops={stops} renderDetail={detail} renderOverview={overview} label={`Walkthrough of ${event.title}`} />;
}
