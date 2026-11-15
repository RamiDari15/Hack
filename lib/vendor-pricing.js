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
