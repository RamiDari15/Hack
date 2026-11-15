'use client';

import { useState } from 'react';

const LABELS = { booked: 'Booked', tentative: 'Tentative', blocked: 'Blocked' };
const dayKey = (iso) => iso.slice(0, 10);

export default function VendorCalendar({ entries }) {
  const first = entries[0]?.starts_at ?? new Date().toISOString();
  const [month, setMonth] = useState(() => first.slice(0, 7));
  const [selected, setSelected] = useState(null);
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const monthEntries = entries.filter((e) => e.starts_at.startsWith(month));
  const visible = selected ? monthEntries.filter((e) => dayKey(e.starts_at) === selected) : monthEntries;
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const minMonth = entries[0]?.starts_at.slice(0, 7) ?? month;
  const maxMonth = entries.at(-1)?.starts_at.slice(0, 7) ?? month;

  function move(delta) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7);
    setMonth(next);
    setSelected(null);
  }

  return <section className="stack vendor-calendar" aria-labelledby="schedule-title">
    <h2 id="schedule-title" className="display-3">Schedule</h2>
    {entries.length ? <>
      <div className="between">
        <button className="btn btn-outline" type="button" onClick={() => move(-1)} disabled={month <= minMonth} aria-label="Previous month">←</button>
        <h3 className="title" aria-live="polite">{monthLabel}</h3>
        <button className="btn btn-outline" type="button" onClick={() => move(1)} disabled={month >= maxMonth} aria-label="Next month">→</button>
      </div>
      <table className="calendar-grid"><caption className="sr-only">{monthLabel} schedule</caption>
        <thead><tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <th key={d} scope="col">{d}</th>)}</tr></thead>
        <tbody>{Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => <tr key={week}>
          {Array.from({ length: 7 }, (_, weekday) => {
            const day = week * 7 + weekday - offset + 1;
            if (day < 1 || day > days) return <td key={weekday} />;
            const key = `${month}-${String(day).padStart(2, '0')}`;
            const events = monthEntries.filter((e) => dayKey(e.starts_at) === key);
            const status = events[0]?.status;
            return <td key={weekday}><button type="button" className={`calendar-day ${status ? `calendar-${status}` : ''}`} aria-pressed={selected === key} aria-label={`${monthLabel} ${day}${status ? `, ${LABELS[status]}` : ', no scheduled entry'}`} onClick={() => setSelected(selected === key ? null : key)}>
              <span>{day}</span>{status && <span className="calendar-dot" aria-hidden="true" />}
            </button></td>;
          })}
        </tr>)}</tbody>
      </table>
      <div className="row calendar-legend">{Object.entries(LABELS).map(([status, label]) => <span key={status} className={`small calendar-${status}`}><i className="calendar-dot" aria-hidden="true" /> {label}</span>)}</div>
      {selected && <button className="back-link" type="button" onClick={() => setSelected(null)}>Show all dates this month</button>}
      <ul className="calendar-agenda" aria-live="polite">{visible.map((e) => <li key={e.id} className="between">
        <div><time className="small num" dateTime={e.starts_at}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(e.starts_at))}</time><p className="small">{e.title}</p></div>
        <span className={`badge calendar-${e.status}`}>{LABELS[e.status]}</span>
      </li>)}</ul>
      {visible.length === 0 && <p className="small muted">No entries for {selected ? 'this date' : 'this month'}. Contact the business for real availability.</p>}
    </> : <p className="muted">No calendar has been shared. Contact the business for availability.</p>}
  </section>;
}
