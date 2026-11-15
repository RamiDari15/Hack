'use client';

import { useActionState } from 'react';
import { requestQuote } from '@/app/events/actions';

export default function RequestQuote({ vendorId, vendorName, events }) {
  const [state, action, pending] = useActionState(requestQuote, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="vendor_id" value={vendorId} />
      <div className="field"><label htmlFor="rq-event">For which event?</label>
        <select id="rq-event" name="event_id">{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
      <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /><span>Send an inquiry to {vendorName} with this event’s date, location, and guest count. Nothing is booked or paid.</span></label>
      <button className="btn btn-block" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send inquiry'}</button>
      <div aria-live="polite">
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.message}</p>}
      </div>
    </form>
  );
}
