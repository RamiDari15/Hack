"""Generate reproducible planning budgets, kept separate from published offers."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Illustrative planning allowances, not researched business rates or vendor quotes.
MODELS = {
    'Venues': ('event', [2000, 5000, 10000], ['Space rental', 'Tables and chairs allowance', 'Setup and cleanup allowance']),
    'Catering': ('person', [25, 55, 95], ['Food allowance', 'Service staffing allowance', 'Tableware allowance']),
    'Photography': ('event', [800, 2000, 4000], ['Event coverage allowance', 'Image editing allowance', 'Digital delivery allowance']),
    'Videography': ('event', [1000, 2500, 5000], ['Filming allowance', 'Editing allowance', 'Highlight film allowance']),
    'Florists': ('event', [500, 1500, 3500], ['Personal flowers allowance', 'Table arrangements allowance', 'Delivery and setup allowance']),
    'Music & DJ': ('event', [600, 1300, 2500], ['Performance allowance', 'Sound equipment allowance', 'Lighting allowance']),
    'Cake & desserts': ('person', [5, 9, 15], ['Dessert servings allowance', 'Decoration allowance', 'Delivery allowance']),
    'Hair & makeup': ('person', [100, 200, 325], ['Styling allowance', 'Makeup allowance', 'Touch-up allowance']),
    'Transportation': ('hour', [100, 175, 300], ['Vehicle allowance', 'Professional driver allowance', 'Fuel allowance']),
    'Rentals': ('event', [400, 1200, 3000], ['Equipment allowance', 'Delivery allowance', 'Setup and collection allowance']),
    'Planners': ('event', [800, 2500, 6000], ['Planning support allowance', 'Vendor coordination allowance', 'Event-day support allowance']),
    'Bar services': ('person', [15, 30, 50], ['Bartending staff allowance', 'Mixers and garnishes allowance', 'Bar setup allowance']),
    'Photo booth': ('event', [350, 650, 1100], ['Booth rental allowance', 'Attendant allowance', 'Prints and gallery allowance']),
    'Decor & styling': ('event', [600, 1800, 4500], ['Decor pieces allowance', 'Styling allowance', 'Installation and removal allowance']),
    'Entertainment': ('event', [400, 1000, 2200], ['Performer allowance', 'Equipment allowance', 'Setup allowance']),
}


def options(record):
    unit, amounts, includes = MODELS[record['category']]
    factor = .90 + int(hashlib.sha256(record['source_url'].encode()).hexdigest()[:8], 16) % 26 / 100
    result = []
    for tier, amount in zip(('Essentials', 'Signature', 'Premium'), amounts):
        step = 1 if unit == 'person' else 5 if unit == 'hour' else 25
        low = max(step, round(amount * factor * .85 / step) * step)
        high = max(low, round(amount * factor * 1.20 / step) * step)
        result.append(dict(title=tier, min_cents=low*100, max_cents=high*100,
                           unit=unit, minimum_quantity=3 if unit == 'hour' else 1,
                           includes=includes, currency='USD', kind='budget_option'))
    return result


def main():
    records = json.loads((ROOT/'data/vendors/public-businesses.json').read_text())
    result = {r['source_url']: options(r) for r in records}
    (ROOT/'data/vendors/budget-options.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n')
    print(f'Generated {sum(map(len, result.values()))} budget options for {len(result)} businesses; published offers unchanged.')


if __name__ == '__main__':
    main()
