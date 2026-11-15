import {csvCell,csvDocument} from '../lib/csv.js';
import assert from 'node:assert/strict';
import { readBudgetOption, budgetTotal, budgetRate, publishedRate, pricingContext, planningSelection, publishedOption } from '../lib/vendor-pricing.js';

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

assert.equal(pricingContext('Hair & makeup','person',100).quantity,4);
assert.equal(pricingContext('Catering','person',72).quantity,72);
assert.equal(pricingContext('Photography','hour',120).quantity,4);
assert.equal(planningSelection(option,4).max_cents,30000);
assert.equal(planningSelection(option,0),null);

assert.equal(publishedOption({title:'Published',priceCents:null,note:'Published range: 40–60 USD. Per person.'}).unit,'person');
assert.equal(publishedOption({title:'Unknown',priceCents:null,note:'Contact us'}),null);
assert.equal(planningSelection(publishedOption({title:'Coverage',priceCents:120000}),1).max_cents,120000);

assert.equal(csvCell('=1+1'),'"\'=1+1"');
assert.equal(csvCell('Avery, Brooks'),'"Avery, Brooks"');
assert.ok(csvDocument(['Name'],[['Taylor "T" Reed']]).includes('"Taylor ""T"" Reed"'));
console.log('PASS: pricing sources, service quantities, planning selections and safe CSV exports');
