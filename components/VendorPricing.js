'use client';
import { useId, useState } from 'react';
import { budgetRate, budgetTotal, priceRange, pricingContext } from '@/lib/vendor-pricing';
import VendorEventActions from '@/components/VendorEventActions';

export default function VendorPricing({ options = [], category, directoryListed, vendorId, events=[], signedIn=false }) {
  const id=useId();const unit=options[0]?.unit;
  const context=pricingContext(category,unit,events[0]?.guest_count);
  const [quantity,setQuantity]=useState(String(context.quantity));
  const [chosen,setChosen]=useState('');
  if(!options.length)return null;
  const counted=unit==='person'||unit==='hour';
  return <section className="stack pricing-section" aria-labelledby={`${id}-heading`}>
    <div className="between pricing-heading"><div className="stack-sm"><span className="label">Plan your spend</span><h2 id={`${id}-heading`} className="display-3">Pricing options</h2>
      <p className="fine">Compare service levels for your {unit==='person'&&category==='Hair & makeup'?'styling party':'event'}. {directoryListed?'Planning ranges; request a final quote from the business.':'Choose the coverage that fits your day.'}</p></div>
      {counted&&<div className="field pricing-quantity"><label htmlFor={`${id}-quantity`}>{context.label}</label><input id={`${id}-quantity`} type="number" min="1" max="5000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></div>}
    </div>
    <div className="pricing-options">{options.map((option,i)=>{
      const total=budgetTotal(option,counted?quantity:1),selected=chosen===option.title;
      return <article className={`pricing-option${selected?' pricing-option-selected':''}`} key={option.title}>
        <div className="between"><span className="label">0{i+1}</span>{i===1&&<span className="badge badge-sun">Balanced choice</span>}</div>
        <h3 className="title">{option.title}</h3>
        <div className="pricing-total-hero" aria-live="polite"><p className="fine">{total?(counted?`Planning total · ${total.units} ${context.noun}`:'Planning total · one event'):'Enter a quantity from 1 to 5,000'}</p>{total&&<p className="pricing-amount num">{priceRange(total.minCents,total.maxCents).split('–').map((part,index)=><span key={index}>{index>0&&<span aria-hidden="true">– </span>}{part}</span>)}</p>}<p className="fine num">{budgetRate(option)}</p></div>
        <ul className="pricing-includes">{option.includes.map(item=><li key={item}>{item}</li>)}</ul>
        {option.minimum_quantity>1&&<p className="fine">{option.minimum_quantity}-{option.unit} minimum</p>}
        <button type="button" className={`btn btn-sm ${selected?'':'btn-outline'}`} disabled={!total} aria-pressed={selected} onClick={()=>setChosen(option.title)}>{selected?'✓ Selected':'Choose this option'}</button>
      </article>;
    })}</div>
    {chosen&&vendorId&&<div className="panel pricing-event-picker stack"><div><h3 className="title">Add {chosen} to your plan</h3><p className="fine">Keep this vendor and planning amount with the right event.</p></div><VendorEventActions vendorId={vendorId} events={events} signedIn={signedIn} pricingTitle={chosen} quantityNoun={context.noun} quantity={counted?quantity:1}/></div>}
    <p className="fine">USD · Taxes, travel, gratuity and venue fees may be separate.{unit==='person'&&options[0]?.includes.some(item=>/Bartending/.test(item))?' Alcohol purchases are separate.':''}</p>
  </section>;
}
