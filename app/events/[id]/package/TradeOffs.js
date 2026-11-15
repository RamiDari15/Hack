'use client';

import { useMemo, useState } from 'react';

// Budget trade-off tool. Nothing here is saved: it is a what-if over the event's real package
// picks and AI estimate ranges. Per-guest categories scale with the guest count; picks priced
// per person scale too, flat quotes do not.
const usd = (c) => `$${Math.round(c / 100).toLocaleString('en-US')}`;
const LEVELS = [{ key: 'low', label: 'Save' }, { key: 'mid', label: 'Middle' }, { key: 'high', label: 'Splurge' }];

export default function TradeOffs({ rows, budgetCents, guestCount }) {
  const baseGuests = guestCount || 100;
  const [guests, setGuests] = useState(baseGuests);
  const [level, setLevel] = useState(() => Object.fromEntries(rows.map((r) => [r.name, 'mid'])));
  const [off, setOff] = useState({});

  const cost = (r, lv = level[r.name], g = guests) => {
    const scale = r.perGuest ? g / baseGuests : 1;
    if (r.kind === 'pick') return Math.round(r.fixedCents * (r.perPersonPick ? g / baseGuests : 1));
    const base = lv === 'low' ? r.lowCents : lv === 'high' ? r.highCents : Math.round((r.lowCents + r.highCents) / 2);
    return Math.round(base * scale);
  };
  const total = rows.reduce((n, r) => n + (off[r.name] ? 0 : cost(r)), 0);
  const diff = budgetCents == null ? null : budgetCents - total;

  // Ideas when over budget: the biggest single changes, from real rows only.
  const ideas = useMemo(() => {
    if (diff == null || diff >= 0) return [];
    const out = [];
    for (const r of rows) {
      if (off[r.name]) continue;
      if (r.kind === 'estimate' && level[r.name] !== 'low') out.push({ text: `Set ${r.name} to Save`, saves: cost(r) - cost(r, 'low') });
      if (r.optional) out.push({ text: `Skip ${r.name}`, saves: cost(r) });
    }
    const fewer = Math.max(10, Math.round(guests * 0.9));
    const perGuestNow = rows.reduce((n, r) => n + (off[r.name] ? 0 : cost(r)), 0);
    const perGuestFewer = rows.reduce((n, r) => n + (off[r.name] ? 0 : cost(r, level[r.name], fewer)), 0);
    if (perGuestNow - perGuestFewer > 0) out.push({ text: `Invite ${guests - fewer} fewer guests (${fewer})`, saves: perGuestNow - perGuestFewer });
    return out.filter((i) => i.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 4);
  }, [diff, rows, level, off, guests]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = budgetCents ? Math.min(100, Math.round((total / budgetCents) * 100)) : 0;
  return (
    <section className="panel stack tradeoffs" aria-labelledby="to-h">
      <div className="panel-head"><h2 id="to-h">Budget trade-offs</h2><span className="badge badge-plain">What-if, not saved</span></div>
      <div className="field">
        <label htmlFor="to-guests">Guests: <b className="num">{guests}</b>{guests !== baseGuests ? <span className="fine"> (event has {guestCount ?? 'no count'})</span> : null}</label>
        <input id="to-guests" type="range" min={10} max={Math.max(400, baseGuests * 2)} step={5} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
      </div>

      <div className="tradeoff-total" aria-live="polite">
        <p className="display-3 num">{usd(total)}</p>
        {diff != null && <p className={`small ${diff < 0 ? 'text-warn' : 'text-ok'}`}>{diff < 0 ? `${usd(-diff)} over your ${usd(budgetCents)} budget` : `${usd(diff)} left of your ${usd(budgetCents)} budget`}</p>}
        {budgetCents != null && <div className="guide-bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: diff < 0 ? 'var(--danger)' : undefined }} /></div>}
      </div>

      <ul role="list" className="tradeoff-rows">
        {rows.map((r) => (
          <li key={r.name} className={off[r.name] ? 'is-off' : undefined}>
            <div className="stack-sm">
              <p className="title">{r.name}</p>
              <p className="fine">{r.kind === 'pick' ? `${r.vendor}: ${r.source}` : `AI estimate ${usd(r.lowCents)}–${usd(r.highCents)}`}{r.perGuest || r.perPersonPick ? ', scales with guests' : ''}</p>
            </div>
            {r.kind === 'estimate' ? (
              <fieldset className="seg" disabled={Boolean(off[r.name])}>
                <legend className="sr-only">{r.name} level</legend>
                {LEVELS.map((l) => (
                  <label key={l.key}><input type="radio" name={`lv-${r.name}`} checked={level[r.name] === l.key} onChange={() => setLevel({ ...level, [r.name]: l.key })} /><span>{l.label}</span></label>
                ))}
              </fieldset>
            ) : <span className="badge badge-ok">Chosen</span>}
            <p className="num tradeoff-amt">{off[r.name] ? '—' : usd(cost(r))}</p>
            <label className="check-row small"><input type="checkbox" checked={!off[r.name]} onChange={(e) => setOff({ ...off, [r.name]: !e.target.checked })} /><span>Include</span></label>
          </li>
        ))}
      </ul>

      {ideas.length > 0 && (
        <div className="stack-sm">
          <p className="label">Ways to get back on budget</p>
          <ul className="small">{ideas.map((i) => <li key={i.text}>{i.text}: saves about <b className="num">{usd(i.saves)}</b></li>)}</ul>
        </div>
      )}
      <p className="fine">Estimates are the planner’s ranges, not prices. Chosen vendors use their quote, your planned amount or their published price, as shown. Per-guest scaling is a rough guide.</p>
    </section>
  );
}
