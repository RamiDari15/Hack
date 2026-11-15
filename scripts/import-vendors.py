"""Idempotently import the researched directory and clearly marked demo calendars.

Only the local supabase_db_vendora Docker container is supported. No vendor accounts,
reviews, verified badges, customer bookings or outbound messages are created.
"""
import argparse
from collections import Counter
from datetime import datetime, timedelta
import json
import random
from pathlib import Path
import subprocess
import uuid
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = uuid.UUID('76542a4d-e4eb-4a11-ae66-5c9a99221e80')


def identity(value):
    return str(uuid.uuid5(NAMESPACE, value))


def literal(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    return "'" + str(value).replace("'", "''") + "'"


def make_demo_reviews(record, vendor_id):
    """Fictional names and natural copy; the UI labels this entire section as demo."""
    rng = random.Random(vendor_id)
    count = rng.randint(3, 20)
    first_names = ['Olivia', 'Ethan', 'Maya', 'Daniel', 'Sofia', 'Marcus', 'Emma', 'Noah',
                   'Amelia', 'Liam', 'Isabella', 'James', 'Ava', 'Benjamin', 'Chloe', 'Elijah',
                   'Priya', 'Arjun', 'Leila', 'Omar', 'Grace', 'Lucas', 'Nora', 'Adrian',
                   'Zoe', 'Miles', 'Hannah', 'Julian', 'Natalie', 'Caleb', 'Elena', 'Isaac',
                   'Camila', 'Mateo', 'Aaliyah', 'Jordan', 'Victoria', 'Andre', 'Claire', 'Nathan']
    last_names = ['Bennett', 'Chen', 'Patel', 'Rivera', 'Williams', 'Morgan', 'Nguyen', 'Brooks',
                  'Reed', 'Sullivan', 'Carter', 'Hayes', 'Park', 'Mitchell', 'Anderson', 'Garcia',
                  'Shah', 'Ali', 'Foster', 'Diaz', 'Walker', 'Collins', 'Turner', 'Kim',
                  'Martinez', 'Hughes', 'Robinson', 'Cooper', 'Ramirez', 'Miller', 'Wilson', 'Lewis']
    names = rng.sample([f'{first} {last}' for first in first_names for last in last_names], count)
    category_details = {
        'Venues': ['The space felt comfortable without feeling crowded.', 'Having room for both the reception and quieter conversations worked well.', 'The layout made it easy for guests to move around.'],
        'Catering': ['The food arrived ready to serve and the portions worked well for our group.', 'Our guests kept asking about the menu.', 'They helped us think through dietary preferences before the event.'],
        'Photography': ['We appreciated the mix of candid moments and family photos.', 'The photographer helped everyone feel comfortable in front of the camera.', 'They kept the photo timeline moving without making us feel rushed.'],
        'Videography': ['The coverage felt unobtrusive during the ceremony and speeches.', 'We appreciated how carefully the key moments were planned.', 'It was helpful to discuss the editing style before the event.'],
        'Florists': ['The arrangements tied the room together beautifully.', 'The color palette worked well with the rest of our decorations.', 'Talking through seasonal options made the decisions much easier.'],
        'Music & DJ': ['The music moved naturally from dinner into dancing.', 'They listened to our must-play list and read the room well.', 'The announcements were clear and the evening kept moving.'],
        'Planners': ['Having someone manage the timeline let us enjoy the day.', 'The planning checklist helped us keep track of the smaller details.', 'They kept the different parts of the event moving together.'],
        'Rentals': ['The delivery and pickup windows were easy to plan around.', 'The pieces suited the space and looked good together.', 'The order checklist made setup much more straightforward.'],
        'Entertainment': ['The activity gave our guests something fun to do between the main events.', 'The entertainment suited the mix of ages in our group.', 'It was a fun addition to the evening without taking over the whole event.'],
    }
    openings = ['We had a lovely experience from the first conversation through the event.',
                'The planning process felt straightforward, which we really appreciated.',
                'A good fit for the relaxed celebration we had in mind.',
                'We booked for a family celebration and were happy with how the day came together.',
                'The team was approachable and took time to understand our plans.',
                'We were balancing a lot of details, and the communication helped.',
                'Everything felt well organized on the day.',
                'We appreciated the practical advice during planning.']
    closings = ['We would consider them again for another event.', 'Glad we talked through the details in advance.',
                'Our guests had a great time.', 'A positive experience overall.',
                'Worth discussing your plans with the team.', 'We were able to relax and enjoy the celebration.']
    constructive = ['The experience was good overall, although a clearer breakdown of the options up front would have helped.',
                    'We liked the end result. We would allow a little more time for the final planning details next time.',
                    'A solid experience overall. A few more updates in the week before the event would have been useful.']
    reviews = []
    for n, author in enumerate(names):
        rating = rng.choice([3, 4, 4, 4, 5, 5, 5])
        detail = rng.choice(category_details.get(record['category'], ['The setup worked well for the event we had planned.']))
        body = f'{rng.choice(openings)} {detail} {rng.choice(closings)}' if rating > 3 else f'{rng.choice(constructive)} {detail}'
        reviews.append({'id': identity(record['source_url'] + ':demo-review:' + str(n)),
                        'rating': rating, 'author': author, 'body': body, 'is_demo': True})
    return reviews


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Write to the local Vendora database')
    parser.add_argument('--reviews-only', action='store_true', help='Refresh only the synthetic review field')
    parser.add_argument('--new-only', action='store_true', help='Insert only new source profiles, preserving existing calendars and reviews')
    args = parser.parse_args()
    records = json.loads((ROOT / 'data/vendors/public-businesses.json').read_text())
    if len(records) < 500 or len({r['source_url'] for r in records}) != len(records):
        raise SystemExit('Expected at least 500 distinct sourced businesses.')
    if any(not r['photos'] or not r['name'] or not r['city'] for r in records):
        raise SystemExit('Every business needs a name, city, source and portfolio photo.')
    today = datetime.now(ZoneInfo('America/Detroit')).date()
    sql = ['begin;']
    existing = set()
    if args.new_only:
        existing = set(subprocess.run(['docker', 'exec', 'supabase_db_vendora', 'psql', '-U', 'postgres', '-At', '-c', 'select id from public.vendors;'], capture_output=True, text=True, check=True).stdout.splitlines())
    for index, r in enumerate(records):
        vendor_id = identity(r['source_url'])
        if vendor_id in existing:
            continue
        demo_reviews = make_demo_reviews(r, vendor_id)
        if args.reviews_only:
            sql.append(f'update public.vendors set demo_reviews={literal(json.dumps(demo_reviews))} where id={literal(vendor_id)} and directory_listed;')
            continue
        values = {
            'id': vendor_id, 'owner_id': None, 'name': r['name'][:120], 'category': r['category'],
            'city': r['city'], 'description': r['description'], 'website': r['website'],
            'phone': r['phone'], 'instagram_url': r['instagram_url'], 'street_address': r['address'],
            'directory_listed': True, 'source_url': r['source_url'], 'sourced_at': r['collected_at'],
            'portfolio_photos': json.dumps(r['photos']),
            'published_hours': json.dumps(r['published_hours']) if r['published_hours'] else None,
            'calendar_is_demo': True,
            'latitude': r.get('latitude'), 'longitude': r.get('longitude'),
            'demo_reviews': json.dumps(demo_reviews),
            'setup_requirements': 'Confirm load-in, power, access, staffing and cleanup requirements directly with the business.',
            'booking_policy': 'Request the business’s current contract, deposit, cancellation and rescheduling terms before booking.',
        }
        columns = ','.join(values)
        updates = ','.join(f'{k}=excluded.{k}' for k in values if k not in ('id', 'owner_id'))
        sql.append(f"insert into public.vendors ({columns}) values ({','.join(literal(v) for v in values.values())}) on conflict (id) do update set {updates};")
        for number, offer in enumerate(r['offers']):
            low, high = offer.get('min'), offer.get('max')
            price = f"Published range: {low:g}–{high:g} {offer['currency']}." if isinstance(low, (int, float)) and isinstance(high, (int, float)) else 'Contact the business for current pricing.'
            unit = {'E48': 'Per event.', 'C62': 'Confirm the per-person or package basis with the business.'}.get(offer.get('unit'), 'Confirm the pricing basis with the business.')
            note = f'{price} {unit} Source: {r["source_url"]} Prices and inclusions may change.'
            package_id = identity(r['source_url'] + ':package:' + str(number))
            sql.append(f"insert into public.vendor_packages (id,vendor_id,title,price_cents,description) values ({literal(package_id)},{literal(vendor_id)},{literal(offer['title'])},null,{literal(note)}) on conflict (id) do update set title=excluded.title,description=excluded.description;")
        # Replace only this import's demo entries; never alter an actual calendar or booking.
        sql.append(f'delete from public.vendor_calendar_entries where vendor_id={literal(vendor_id)} and is_demo;')
        for number in range(36):
            day = today + timedelta(days=1 + (index * 7 + number * 5) % 180)
            status = ['booked', 'booked', 'tentative', 'booked', 'blocked', 'booked'][number % 6]
            title = {'booked': ['Private celebration', 'Wedding', 'Corporate event', 'Community gathering'][number % 4],
                     'tentative': 'Provisional event hold', 'blocked': 'Team unavailable'}[status]
            entry_id = identity(r['source_url'] + ':calendar:' + str(day))
            sql.append(f"insert into public.vendor_calendar_entries (id,vendor_id,starts_at,ends_at,status,title,is_demo) values ({literal(entry_id)},{literal(vendor_id)},{literal(str(day)+'T00:00:00Z')},{literal(str(day+timedelta(days=1))+'T00:00:00Z')},{literal(status)},{literal(title)},true);")
    sql.append("notify pgrst, 'reload schema'; commit;")
    print(json.dumps({'vendors': len(records), 'photos': sum(len(r['photos']) for r in records),
                      'published_packages': sum(len(r['offers']) for r in records),
                      'demo_calendar_entries': len(records) * 36,
                      'categories': dict(Counter(r['category'] for r in records))}, indent=2))
    if not args.apply:
        print('Dry run only. Use --apply to import into the local Vendora container.')
        return
    proc = subprocess.run(['docker', 'exec', '-i', 'supabase_db_vendora', 'psql', '-U', 'postgres',
                           '-v', 'ON_ERROR_STOP=1', '-q'], input='\n'.join(sql), text=True,
                          capture_output=True)
    if proc.returncode:
        print(proc.stderr)
        raise SystemExit('Import failed; the transaction was rolled back.')
    print('Imported successfully into local Vendora. Public listings remain unverified; all calendar entries are demo data.')


if __name__ == '__main__':
    main()
