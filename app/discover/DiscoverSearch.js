'use client';

import { useState } from 'react';
import Link from 'next/link';
import SaveResult from './SaveResult';

export default function DiscoverSearch({ signedIn, configured, verified, verifiedMode, events = [] }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle', results: [], error: '', at: null });

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setState({ status: 'loading', results: [], error: '', at: null });
    try {
      const res = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Web search is unavailable right now.');
      setState({ status: 'done', results: body.results ?? [], error: '', at: body.retrievedAt });
    } catch (err) {
      setState({ status: 'error', results: [], error: err.message });
    }
  }

  const disabled = !configured || !signedIn;
  return (
    <div className="stack-lg">
      <form onSubmit={search} role="search" className="searchbar" aria-label="Search the web">
        <label htmlFor="q" className="sr-only">Search for venues, vendors or ideas</label>
        <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={300} placeholder="Outdoor venues with string lights near Ann Arbor for 150 guests" />
        <button className="btn" type="submit" disabled={disabled || state.status === 'loading'}>{state.status === 'loading' ? 'Searching…' : 'Search'}</button>
      </form>
      {disabled && <p className="small muted">{configured ? <><Link href="/sign-in?next=/discover">Sign in</Link> to search. Searches count toward a daily limit.</> : 'Sign-in is not connected yet, so web search is off.'}</p>}

      <div className="discover-cols">
        <section aria-labelledby="ver-h" className="stack discover-verified">
          <div className="between"><h2 id="ver-h" className="label">Verified on Vendora</h2>{verifiedMode === 'sample' && <span className="badge">Sample</span>}</div>
          {verified.length ? verified.map((v) => (
            <Link key={v.id} href={`/vendors/${v.id}`} className="result-card result-verified">
              <div className="between"><span className="title">{v.name}</span>{v.sample ? <span className="badge">Sample</span> : <span className="badge badge-ok">Verified</span>}</div>
              <p className="fine">{v.category}, {v.city}</p>
            </Link>
          )) : <p className="muted small">No verified vendors listed yet.</p>}
        </section>

        <section aria-labelledby="ext-h" className="stack" aria-live="polite">
          <div className="between"><h2 id="ext-h" className="label">From the web, confirm the details</h2>{state.at && <span className="fine">Retrieved {new Date(state.at).toLocaleTimeString()}</span>}</div>
          {state.status === 'idle' && <p className="muted small">Web results appear here, each with its source. Prices, capacity and availability are not checked by Vendora.</p>}
          {signedIn && events.length === 0 && <p className="fine"><Link href="/events/new">Create an event</Link> to save results to it.</p>}
          {state.status === 'loading' && <div className="skeleton" aria-busy="true"><i /><i /><i /></div>}
          {state.status === 'error' && <p className="notice notice-error" role="alert">{state.error}</p>}
          {state.status === 'done' && state.results.length === 0 && <p className="muted small">No web results for that search.</p>}
          {state.results.map((r) => (
            <article className="result-card" key={r.url}>
              <div className="between"><h3 className="title">{r.title}</h3><span className="badge badge-warn">External, confirm</span></div>
              {r.snippet && <p className="small muted">{r.snippet}</p>}
              <a className="small" href={r.url} target="_blank" rel="noopener noreferrer nofollow">{r.host}<span className="sr-only"> (opens in a new tab)</span></a>
              <SaveResult result={r} events={events} />
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
