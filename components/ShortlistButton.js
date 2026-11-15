import ActionForm from '@/components/forms/ActionForm';
import { addToShortlist } from '@/app/actions/shared';

// Adds a vendor to one of the user's events' shortlists. Works for public listings too: a
// shortlist is just a saved comparison, not an inquiry.
export default function ShortlistButton({ vendorId, events, eventId, compact = false }) {
  if (eventId) {
    return (
      <ActionForm action={addToShortlist} className="row">
        <input type="hidden" name="vendor_id" value={vendorId} />
        <input type="hidden" name="event_id" value={eventId} />
        <button className="btn btn-sm btn-outline" type="submit">Add to shortlist</button>
      </ActionForm>
    );
  }
  if (!events?.length) return null;
  return (
    <ActionForm action={addToShortlist} className={compact ? 'row' : 'stack-sm'}>
      <input type="hidden" name="vendor_id" value={vendorId} />
      <div className="field"><label htmlFor={`sl-ev-${vendorId}`}>Shortlist for</label>
        <select id={`sl-ev-${vendorId}`} name="event_id">{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
      <button className="btn btn-outline" type="submit">Add to shortlist</button>
    </ActionForm>
  );
}
