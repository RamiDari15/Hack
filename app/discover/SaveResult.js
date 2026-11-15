'use client';

import { useActionState } from 'react';
import { saveExternalResult } from '@/app/events/actions';

export default function SaveResult({ result, events }) {
  const [state, action, pending] = useActionState(saveExternalResult, null);
  if (!events.length) return null;
  return (
    <form action={action} className="save-result">
      <input type="hidden" name="url" value={result.url} />
      <input type="hidden" name="title" value={result.title} />
      <input type="hidden" name="snippet" value={result.snippet ?? ''} />
      <label className="sr-only" htmlFor={`ev-${result.url}`}>Event to save to</label>
      <select id={`ev-${result.url}`} name="event_id" className="input-sm">
        {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
      <button className="btn btn-sm btn-outline" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save to event'}</button>
      <span aria-live="polite" className="fine">{state?.error ? <span className="error-text">{state.error}</span> : state?.message}</span>
    </form>
  );
}
