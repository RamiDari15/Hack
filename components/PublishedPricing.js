'use client';
import {useId,useState} from 'react';
import {publishedOption,budgetTotal,priceRange,pricingContext,publishedRate} from '@/lib/vendor-pricing';
import VendorEventActions from '@/components/VendorEventActions';
function PublishedCard({pack,vendorId,events,signedIn,category}){
 const option=publishedOption(pack),id=useId();const context=pricingContext(category,option?.unit,events[0]?.guest_count);
 const [quantity,setQuantity]=useState(String(context.quantity)),[open,setOpen]=useState(false);
 const total=option&&budgetTotal(option,quantity);
 return <article className="panel stack"><h3 className="title">{pack.title}</h3><p className="pricing-rate num">{publishedRate(pack)||'Request a quote'}</p>
  {option&&option.unit!=='event'&&<div className="field"><label htmlFor={id}>{context.label}</label><input id={id} type="number" min="1" max="5000" value={quantity} onChange={e=>setQuantity(e.target.value)}/>{total&&<p className="fine num">{option.starting?'From ':''}{priceRange(total.minCents,total.maxCents)} for {total.units} {context.noun}</p>}</div>}
  {option&&pack.id&&<button className="btn btn-sm btn-outline" type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>Use this published option {open?'−':'+'}</button>}
  {open&&<VendorEventActions vendorId={vendorId} publishedPackageId={pack.id} selectionLabel={pack.title} quantityNoun={context.noun} quantity={option.unit==='event'?1:quantity} events={events} signedIn={signedIn}/ >}
 </article>;
}
export default function PublishedPricing({packages=[],vendorId,events=[],signedIn=false,category,sourceUrl}){
 if(!packages.length)return null;
 return <section className="stack"><div><span className="label">From the business</span><h2 className="display-3">Published pricing</h2><p className="fine">Publicly listed services. Confirm availability, inclusions and the final total directly.</p></div><div className="published-pricing-grid">{packages.map((p,i)=><PublishedCard key={p.id||i} pack={p} vendorId={vendorId} events={events} signedIn={signedIn} category={category}/>)}</div>{sourceUrl&&<p className="fine"><a href={sourceUrl} target="_blank" rel="noopener noreferrer">View original pricing details ↗</a></p>}</section>;
}
