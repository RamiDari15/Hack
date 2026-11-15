const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const UNIT_LABELS = { person: 'person', hour: 'hour', event: 'event' };

export function readBudgetOption(description) {
  try {
    const value = JSON.parse(description);
    if (value.kind !== 'budget_option' || !UNIT_LABELS[value.unit] || value.currency !== 'USD'
      || !Number.isSafeInteger(value.min_cents) || !Number.isSafeInteger(value.max_cents)
      || value.min_cents <= 0 || value.max_cents < value.min_cents
      || !Number.isSafeInteger(value.minimum_quantity) || value.minimum_quantity < 1
      || !Array.isArray(value.includes) || value.includes.some((item) => typeof item !== 'string')
      || typeof value.title !== 'string') return null;
    return value;
  } catch { return null; }
}

export function priceRange(minCents, maxCents) {
  const low = usd.format(minCents / 100);
  return minCents === maxCents ? low : `${low}–${usd.format(maxCents / 100)}`;
}

export function budgetTotal(option, quantity) {
  const entered = Number(quantity);
  if (!Number.isSafeInteger(entered) || entered < 1 || entered > 5000) return null;
  const units = option.unit === 'event' ? 1 : Math.max(entered, option.minimum_quantity);
  return { minCents: option.min_cents * units, maxCents: option.max_cents * units, units };
}

export function budgetRate(option) {
  return `${priceRange(option.min_cents, option.max_cents)} / ${UNIT_LABELS[option.unit]}`;
}

export function publishedRate(pack) {
  if (pack.priceCents != null) return usd.format(pack.priceCents / 100);
  const range = /Published range: ([\d.]+)–([\d.]+) USD\./.exec(pack.note ?? '');
  const starting = /Published starting price: ([\d.]+) USD\./.exec(pack.note ?? '');
  if (!range && !starting) return null;
  const rate = range ? priceRange(Math.round(Number(range[1])*100), Math.round(Number(range[2])*100))
    : `From ${usd.format(Number(starting[1]))}`;
  const unit = /Per person\./.test(pack.note) ? 'person' : /Per hour\./.test(pack.note) ? 'hour'
    : /Per event\./.test(pack.note) ? 'event' : null;
  return unit ? `${rate} / ${unit}` : rate;
}

// Quantities describe the service, not always the whole guest list.
export function pricingContext(category, unit, guestCount) {
  if (unit === 'hour') return { label: 'Service hours', noun: 'hours', quantity: 4 };
  if (unit === 'event') return { label: 'Events', noun: 'event', quantity: 1 };
  if (category === 'Hair & makeup') return { label: 'People receiving styling', noun: 'people', quantity: 4 };
  return { label: category === 'Bar services' ? 'Guests being served' : 'Number of guests', noun: 'guests', quantity: guestCount || 100 };
}

export function planningSelection(option, quantity) {
  const total = budgetTotal(option, quantity);
  if (!total || total.maxCents > 100000000) return null;
  return { source: 'planning_range', title: option.title, unit: option.unit, quantity: total.units, min_cents: total.minCents, max_cents: total.maxCents };
}

export function publishedOption(pack) {
  const note=pack.note??pack.description??'';
  const fixed=pack.priceCents??pack.price_cents;
  const range=/Published range: ([\d.]+)–([\d.]+) USD\./.exec(note);
  const starting=/Published starting price: ([\d.]+) USD\./.exec(note);
  const low=fixed!=null?Number(fixed):range?Math.round(Number(range[1])*100):starting?Math.round(Number(starting[1])*100):null;
  const high=fixed!=null?Number(fixed):range?Math.round(Number(range[2])*100):low;
  if(!Number.isSafeInteger(low)||low<=0||!Number.isSafeInteger(high)||high<low)return null;
  return {title:pack.title,min_cents:low,max_cents:high,unit:/Per person\./i.test(note)?'person':/Per hour\./i.test(note)?'hour':'event',minimum_quantity:1,starting:Boolean(starting)};
}
