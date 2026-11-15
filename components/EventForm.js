'use client';

import { useActionState } from 'react';
import { EVENT_TYPE_GROUPS } from '@/lib/categories';

function Field({ name, label, errors, children, hint, wide }) {
  const err = errors?.[name];
  return (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {children(err ? { 'aria-invalid': 'true', 'aria-describedby': `${name}-err` } : hint ? { 'aria-describedby': `${name}-hint` } : {})}
      {hint && !err && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {err && <span id={`${name}-err`} className="error">{err}</span>}
    </div>
  );
}

export default function EventForm({ action, initial = {}, submitLabel = 'Create event', eventId, compact }) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state?.values ?? initial;
  const e = state?.errors;
  return (
    <form action={formAction} className={`event-form${compact ? ' event-form-compact' : ''}`} noValidate>
      {eventId && <input type="hidden" name="id" value={eventId} />}
      <Field name="title" label="Event name" errors={e} wide>{(a) => <input id="title" name="title" defaultValue={v.title ?? ''} required maxLength={140} placeholder="Maya and Sam’s garden wedding" {...a} />}</Field>
      <Field name="event_type" label="Event type" errors={e}>{(a) => (
        <select id="event_type" name="event_type" defaultValue={v.eventType ?? 'Wedding'} {...a}>
          {EVENT_TYPE_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.types.map((t) => <option key={t}>{t}</option>)}</optgroup>)}
        </select>)}</Field>
      <Field name="event_date" label="Date" errors={e} hint="Leave empty if you are still deciding.">{(a) => <input id="event_date" name="event_date" type="date" defaultValue={v.eventDate ?? ''} {...a} />}</Field>
      <Field name="location" label="Location" errors={e}>{(a) => <input id="location" name="location" defaultValue={v.location ?? ''} placeholder="City or venue" maxLength={160} {...a} />}</Field>
      <Field name="guest_count" label="Guests" errors={e}>{(a) => <input id="guest_count" name="guest_count" inputMode="numeric" defaultValue={v.guests ?? ''} placeholder="150" {...a} />}</Field>
      <Field name="budget" label="Budget (USD)" errors={e}>{(a) => <input id="budget" name="budget" inputMode="decimal" defaultValue={v.budget ?? ''} placeholder="25000" {...a} />}</Field>
      <Field name="style" label="Style" errors={e}>{(a) => <input id="style" name="style" defaultValue={v.style ?? ''} placeholder="Garden, candlelit" maxLength={160} {...a} />}</Field>
      <Field name="notes" label="Notes" errors={e} hint="Anything vendors or the planner should know." wide>{(a) => <textarea id="notes" name="notes" defaultValue={v.notes ?? ''} maxLength={4000} {...a} />}</Field>
      <div aria-live="polite" className="field-wide">
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">Saved.</p>}
      </div>
      <div className="field-wide"><button className="btn btn-sun btn-lg" type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</button></div>
    </form>
  );
}
