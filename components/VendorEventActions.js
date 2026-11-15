'use client';
import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { planVendor } from '@/app/actions/vendor-planning';
import { EVENT_TYPES } from '@/lib/categories';
export default function VendorEventActions({vendorId,events=[],signedIn=false,eventId='',pricingTitle='',publishedPackageId='',selectionLabel=pricingTitle,quantityNoun='units',quantity=1,compact=false}){
 const id=useId();const [open,setOpen]=useState(!compact);const [event,setEvent]=useState(eventId||events[0]?.id||'new');
 const [state,action,pending]=useActionState(planVendor,null);
 if(!signedIn)return <Link className="btn btn-sm" href={`/sign-in?next=/vendors/${vendorId}`}>Add to an event</Link>;
 return <div className="vendor-event-actions stack-sm">
  {compact&&<button type="button" className="btn btn-sm" aria-expanded={open} onClick={()=>setOpen(!open)}>Add to event {open?'−':'+'}</button>}
  {open&&<form action={action} className="stack-sm">
   <input type="hidden" name="vendor_id" value={vendorId}/><input type="hidden" name="pricing_title" value={pricingTitle}/><input type="hidden" name="published_package_id" value={publishedPackageId}/><input type="hidden" name="quantity" value={quantity}/>
   <div className="field"><label htmlFor={`${id}-event`}>Add to which event?</label><select id={`${id}-event`} name="event_id" value={event} onChange={e=>setEvent(e.target.value)}>
    {events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}<option value="new">＋ Create a new event</option></select></div>
   {event==='new'&&<div className="quick-event-fields stack-sm">
    <div className="field"><label htmlFor={`${id}-name`}>Event name</label><input id={`${id}-name`} name="title" required maxLength={140} placeholder="Our garden celebration"/></div>
    <div className="field"><label htmlFor={`${id}-type`}>Event type</label><select id={`${id}-type`} name="event_type">{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
    <div className="field"><label htmlFor={`${id}-date`}>Date</label><input id={`${id}-date`} type="date" name="event_date"/></div>
    <div className="field"><label htmlFor={`${id}-location`}>Location</label><input id={`${id}-location`} name="location" maxLength={160} placeholder="Ann Arbor, MI"/></div>
    <div className="grid-2"><div className="field"><label htmlFor={`${id}-guests`}>Guests</label><input id={`${id}-guests`} name="guest_count" type="number" min="1" max="100000"/></div><div className="field"><label htmlFor={`${id}-budget`}>Budget ($)</label><input id={`${id}-budget`} name="budget" type="number" min="0" max="1000000" step="0.01"/></div></div>
   </div>}
   {selectionLabel&&<p className="fine">{selectionLabel} · {quantity} {quantityNoun} · saved as a planning amount</p>}
   <button className="btn btn-sm" disabled={pending}>{pending?'Adding…':event==='new'?'Create event & add vendor':'Add vendor to event'}</button>
   <div aria-live="polite">{state?.error&&<p className="notice notice-error" role="alert">{state.error}</p>}{state?.ok&&<p className="notice notice-ok">{state.message} <Link href={state.href}>Open event shortlist →</Link></p>}</div>
   {!compact&&<p className="fine">Saved privately to your shortlist. This does not contact or book the business.</p>}
  </form>}
 </div>;
}
