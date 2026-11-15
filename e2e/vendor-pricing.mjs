import assert from 'node:assert/strict';
import { readBudgetOption, budgetTotal, budgetRate, publishedRate } from '../lib/vendor-pricing.js';

const option = { kind: 'budget_option', title: 'Signature', min_cents: 5000, max_cents: 7500,
  currency: 'USD', unit: 'person', minimum_quantity: 1, includes: ['Food allowance'] };
assert.deepEqual(readBudgetOption(JSON.stringify(option)), option);
assert.equal(readBudgetOption('An ordinary vendor package description'), null);
assert.equal(readBudgetOption('null'), null);
assert.equal(readBudgetOption(JSON.stringify({ ...option, min_cents: -100 })), null);
assert.equal(readBudgetOption(JSON.stringify({ ...option, max_cents: 100 })), null);
assert.equal(readBudgetOption(JSON.stringify({ ...option, unit: 'unsupported' })), null);
assert.deepEqual(budgetTotal(option, '100'), { minCents: 500000, maxCents: 750000, units: 100 });
assert.deepEqual(budgetTotal({ ...option, unit: 'hour', minimum_quantity: 3 }, 1),
  { minCents: 15000, maxCents: 22500, units: 3 });
assert.deepEqual(budgetTotal({ ...option, unit: 'event' }, 100),
  { minCents: 5000, maxCents: 7500, units: 1 });
for (const value of ['', 0, -1, 'not a number', 1.5, 5001]) assert.equal(budgetTotal(option, value), null);
assert.equal(budgetRate(option), '$50–$75 / person');
assert.equal(publishedRate({ note: 'Published range: 100–150 USD. Per hour.' }), '$100–$150 / hour');
assert.equal(publishedRate({ note: 'Published range: 4500–4500 USD. Per event.' }), '$4,500 / event');
assert.equal(publishedRate({ note: 'Published starting price: 500 USD. Per person.' }), 'From $500 / person');
assert.equal(publishedRate({ note: 'Contact for pricing.' }), null);
assert.equal(publishedRate({ priceCents: 10000 }), '$100');
console.log('PASS: price ranges, billing units, minimum hours, invalid quantities, and published rates');
