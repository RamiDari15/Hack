'use client';

import { useId, useState } from 'react';
import { budgetRate, budgetTotal, priceRange } from '@/lib/vendor-pricing';

export default function VendorPricing({ options = [] }) {
  const id = useId();
  const unit = options[0]?.unit;
  const [quantity, setQuantity] = useState(unit === 'hour' ? '4' : '100');
  if (!options.length) return null;
  const counted = unit === 'person' || unit === 'hour';
  const noun = unit === 'person' ? 'people' : 'hours';

  return (
    <section className="stack pricing-section" aria-labelledby={`${id}-heading`}>
      <div className="between pricing-heading">
        <h2 id={`${id}-heading`} className="display-3">Pricing options</h2>
        {counted && <div className="field pricing-quantity">
          <label htmlFor={`${id}-quantity`}>{unit === 'person' ? 'Number of people' : 'Service hours'}</label>
          <input id={`${id}-quantity`} type="number" inputMode="numeric" min="1" max="5000" step="1"
            value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </div>}
      </div>
      <div className="pricing-options">
        {options.map((option) => {
          const total = budgetTotal(option, counted ? quantity : 1);
          return <article className="pricing-option" key={option.title}>
            <h3 className="title">{option.title}</h3>
            <p className="pricing-rate num">{budgetRate(option)}</p>
            <ul className="pricing-includes">{option.includes.map((item) => <li key={item}>{item}</li>)}</ul>
            {option.minimum_quantity > 1 && <p className="fine">{option.minimum_quantity}-hour minimum in this budget</p>}
            {counted && <div className="pricing-total" aria-live="polite" aria-atomic="true">
              <p className="fine">{total ? `Budget for ${total.units} ${noun}` : `Enter 1–5,000 ${noun}`}</p>
              {total && <p className="title num">{priceRange(total.minCents, total.maxCents)}</p>}
            </div>}
          </article>;
        })}
      </div>
      <p className="fine">USD. Allow separately for taxes, travel, gratuity, and venue fees.{unit === 'person' && options[0]?.includes.some((item) => /Bartending/.test(item)) ? ' Alcohol purchases are separate.' : ''}</p>
    </section>
  );
}
