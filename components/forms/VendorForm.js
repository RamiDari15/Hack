'use client';

import { useActionState } from 'react';
import { CATEGORIES } from '@/lib/categories';

function Field({ name, label, errors, hint, wide, children }) {
  const err = errors?.[name];
  const a = err ? { 'aria-invalid': 'true', 'aria-describedby': `${name}-err` } : hint ? { 'aria-describedby': `${name}-hint` } : {};
  return (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {children(a)}
      {hint && !err && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {err && <span id={`${name}-err`} className="error">{err}</span>}
    </div>
  );
}

// Used for both applying and editing. `initial` uses the parseVendor value keys.
export default function VendorForm({ action, vendorId, initial = {}, apply }) {
  const [state, formAction, pending] = useActionState(action, { values: initial });
  const v = state?.values ?? initial;
  const e = state?.errors;
  return (
    <form action={formAction} className="event-form" noValidate>
      {vendorId && <input type="hidden" name="id" value={vendorId} />}
      <Field name="name" label="Business name" errors={e} wide>{(a) => <input id="name" name="name" defaultValue={v.name ?? ''} maxLength={120} required {...a} />}</Field>
      <Field name="category" label="Category" errors={e}>{(a) => (
        <select id="category" name="category" defaultValue={v.category ?? ''} {...a}>
          <option value="" disabled>Choose one</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>)}</Field>
      <Field name="city" label="City you work from" errors={e}>{(a) => <input id="city" name="city" defaultValue={v.city ?? ''} maxLength={120} placeholder="Ann Arbor" {...a} />}</Field>
      <Field name="service_radius_mi" label="Travel radius (miles)" errors={e}>{(a) => <input id="service_radius_mi" name="service_radius_mi" inputMode="numeric" defaultValue={v.radius ?? ''} placeholder="40" {...a} />}</Field>
      <Field name="description" label="About your work" errors={e} wide hint="What you offer, your style, what is included.">{(a) => <textarea id="description" name="description" defaultValue={v.description ?? ''} maxLength={4000} {...a} />}</Field>
      <Field name="setup_requirements" label="Setup needs" errors={e} hint="Power, space, load-in time.">{(a) => <textarea id="setup_requirements" name="setup_requirements" defaultValue={v.setup ?? ''} maxLength={2000} {...a} />}</Field>
      <Field name="booking_policy" label="Booking policy" errors={e} hint="Deposits, cancellations.">{(a) => <textarea id="booking_policy" name="booking_policy" defaultValue={v.policy ?? ''} maxLength={2000} {...a} />}</Field>

      <h2 className="display-3 field-wide">For our review</h2>
      <p className="muted small field-wide">Only the Vendora team sees these. The contact email gets booking requests.</p>
      <Field name="legal_name" label="Legal business name" errors={e}>{(a) => <input id="legal_name" name="legal_name" defaultValue={v.legal ?? ''} maxLength={160} {...a} />}</Field>
      <Field name="business_id" label="Business registration number" errors={e} hint="Optional, helps us verify faster.">{(a) => <input id="business_id" name="business_id" defaultValue={v.businessId ?? ''} maxLength={80} {...a} />}</Field>
      <Field name="website" label="Website" errors={e}>{(a) => <input id="website" name="website" type="url" defaultValue={v.website ?? ''} placeholder="https://" maxLength={300} {...a} />}</Field>
      <Field name="contact_email" label="Contact email" errors={e}>{(a) => <input id="contact_email" name="contact_email" type="email" defaultValue={v.email ?? ''} maxLength={200} {...a} />}</Field>
      <Field name="phone" label="Phone" errors={e}>{(a) => <input id="phone" name="phone" type="tel" defaultValue={v.phone ?? ''} maxLength={40} {...a} />}</Field>

      {apply && (
        <div className="field field-wide">
          <label className="check-row"><input type="checkbox" name="confirm" value="yes" aria-invalid={e?.confirm ? 'true' : undefined} /><span>These details are accurate. I understand my profile stays hidden until the Vendora team verifies it.</span></label>
          {e?.confirm && <span className="error">{e.confirm}</span>}
        </div>
      )}
      <div aria-live="polite" className="field-wide">
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.message ?? 'Saved.'}</p>}
      </div>
      <div className="field-wide"><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : apply ? 'Submit for review' : 'Save changes'}</button></div>
    </form>
  );
}
