"""Fill every directory category to 20 with sourced profiles; preserve existing listings.

Run explicitly, then review the JSON diff before importing. Public source pages are
cached by collect-vendors.py. Missing prices, hours and coordinates stay unknown.
"""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import argparse
import html
import importlib.util
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('collector', ROOT / 'scripts/collect-vendors.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
spec2 = importlib.util.spec_from_file_location('expander', ROOT / 'scripts/expand-vendors.py')
e = importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(e)
MINIMUM = 20
DECOR = {
    'The. Fleur Bar / LLC Mona Rosa', 'Events By A Diva LLC', 'Event Designs',
    'Sisterhood Events Collective & Rentals', 'One Step Beyond Events -- Planner Services',
    'Set the Stage Event Planning & Concierge Services', 'Elite Events and Flowers',
    'Nizhoni Designs LLC', "Boston Event Diva's Floral Design & Day Coordination",
    'Urban Blum Co.', 'Matriarch', 'Heffernan Morgan Event Design',
    'Prestige Designs & Events LLC', 'Tylers Custom Designs',
    'ABC – Always Be Creative Flowers & Events', 'Air Tamers Balloon Studio',
    'Paris312', 'Borrowed Blooms & Decor', 'At The Event', 'Prestige Wedding Decoration',
}


def text(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', value)).split())


def available_photo(photos, website):
    for photo in photos[:1]:
        if e.photo_ok(photo):
            return photo
    try:
        page = c.fetch(website)
        candidates = []
        for meta in re.findall(r'<meta\b[^>]+>', page, re.I):
            attrs = dict((k.lower(), html.unescape(v)) for k, _, v in re.findall(
                r'([\w:-]+)\s*=\s*([\"\x27])(.*?)\2', meta, re.S))
            if attrs.get('property', attrs.get('name', '')).lower() in ('og:image', 'twitter:image'):
                candidates.append(attrs.get('content', ''))
        for src in dict.fromkeys(candidates):
            photo = urllib.parse.urljoin(website, src)
            if photo.startswith('http://'):
                photo = 'https://'+photo[7:]
            if not photo.startswith('https://'):
                continue
            try:
                with urllib.request.urlopen(urllib.request.Request(photo, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10) as response:
                    if response.status == 200 and response.headers.get('Content-Type', '').startswith('image/'):
                        response.read(32)
                        return photo
            except Exception:
                continue
    except Exception:
        pass
    return None


def schema_profile(task):
    url, category = task
    try:
        b = next(s for s in c.schemas(c.fetch(url))
                 if s.get('@type') in ('BeautySalon', 'LocalBusiness'))
        a = b.get('address', {})
        country = a.get('addressCountry', 'US')
        if country not in ('US', 'USA', 'United States'):
            return None
        links = b.get('sameAs', [])
        if isinstance(links, str):
            links = [links]
        website = b.get('url') if 'hiremobilebartenders' in url else next(
            (u for u in links if not any(s in u for s in ('facebook.', 'instagram.', 'pinterest.'))), None)
        if website:
            parts = urllib.parse.urlsplit(website)
            website = urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path, parts.query, parts.fragment))
        photos = b.get('image', [])
        if isinstance(photos, str):
            photos = [photos]
        photos = [p for p in photos if isinstance(p, str) and p.startswith('https://')]
        good = available_photo(photos, website) if website else None
        if not website or not good:
            return None
        city = ', '.join(filter(None, [a.get('addressLocality'), a.get('addressRegion')]))
        street_city = re.search(r',\s*([^,]+),\s*([A-Z]{2})\s+\d{5}', a.get('streetAddress', ''))
        if not a.get('addressRegion') and street_city:
            city = street_city[1].strip()+', '+street_city[2]
        if not city:
            return None
        return dict(source_url=url, name=html.unescape(b['name']), category=category,
                    metro='', city=city, address=', '.join(str(a[k]) for k in
                    ('streetAddress', 'addressLocality', 'addressRegion', 'postalCode') if a.get(k)),
                    phone=b.get('telephone'), website=website,
                    instagram_url=next((u for u in links if 'instagram.com/' in u), None),
                    description=' '.join(text(b.get('description', '')).split()[:20]),
                    photos=[good], offers=[],
                    published_hours=b.get('openingHoursSpecification', b.get('openingHours')),
                    latitude=b.get('geo', {}).get('latitude'), longitude=b.get('geo', {}).get('longitude'),
                    collected_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
    except Exception as exc:
        print(f'Skipped {url}: {type(exc).__name__}', flush=True)
        return None


def cakes(url='https://www.weddingrule.com/wedding-cakes/new-york/'):
    content = c.fetch(url)
    for chunk in re.split(r'<div class="col-sm-12 padI0 m-b-50 article-item"', content)[1:]:
        try:
            slug = re.search(r'^ id="([^"]+)"', chunk)[1]
            heading = re.search(r'<h3 class="item-title".*?</h3>', chunk, re.S)[0]
            name = text(re.search(r'<a\b[^>]*>(.*?)</a>', heading, re.S)[1])
            website = html.unescape(re.search(r'href="([^"]+)"', heading)[1])
            photo = html.unescape(re.search(r'<img src="([^"]+)"', chunk)[1])
            address_match = re.search(r'<strong>Address</strong>\s*:\s*(.*?)</p>', chunk, re.S)
            address = text(address_match[1]) if address_match else ''
            phone_match = re.search(r'href="tel:([^"]+)"', chunk)
            insta_match = re.search(r'href="(https://(?:www\.)?instagram.com/[^"]+)"', chunk)
            if not address or not e.photo_ok(photo):
                continue
            # Location is taken from the published address, not the article title.
            city_match = re.search(r'([A-Za-z .\'-]+),?\s+(NY|NJ|CT)\b', address)
            city = text(city_match[1]).split(',')[-1].strip()+', '+city_match[2] if city_match else 'New York'
            yield dict(source_url=url+'#'+slug, name=name, category='Cake & desserts', metro='new-york-ny',
                       city=city, address=address, phone=phone_match[1] if phone_match else None,
                       website=website, instagram_url=insta_match[1] if insta_match else None,
                       description='Wedding cakes and desserts. View the published portfolio and contact the bakery for current options and pricing.',
                       photos=[photo], offers=[], published_hours=None,
                       collected_at=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
        except (TypeError, IndexError):
            continue


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--resume', action='store_true', help='Resume a saved incomplete collection')
    args = parser.parse_args()
    path = ROOT / 'data/vendors/public-businesses.json'
    records = json.loads(path.read_text())
    before = {r['source_url']: dict(r) for r in records}
    if args.resume:
        records = json.loads(Path('/private/tmp/vendora-category-progress.json').read_text())
        if not set(before).issubset({r['source_url'] for r in records}):
            raise SystemExit('Progress file is missing existing listings.')
    counts = Counter(r['category'] for r in records)
    # These businesses explicitly publish the relevant service in their name or description.
    for r in records:
        if counts['Photo booth'] < MINIMUM and r['category'] != 'Photo booth' and re.search(r'photo\s*booth|photobooth', r['name'], re.I):
            counts[r['category']] -= 1; r['category'] = 'Photo booth'; counts[r['category']] += 1
        if counts['Decor & styling'] < MINIMUM and r['category'] != 'Decor & styling' and r['name'] in DECOR:
            counts[r['category']] -= 1; r['category'] = 'Decor & styling'; counts[r['category']] += 1
    urls = {r['source_url'] for r in records}
    names = {e.key(r) for r in records}

    def add(candidates, category):
        for r in candidates:
            if counts[category] >= MINIMUM:
                break
            if r and r['source_url'] not in urls and e.key(r) not in names:
                records.append(r); urls.add(r['source_url']); names.add(e.key(r)); counts[category] += 1
        print(f'{category}: {counts[category]}', flush=True)

    if counts['Cake & desserts'] < MINIMUM:
        add(cakes(), 'Cake & desserts')
    if counts['Cake & desserts'] < MINIMUM:
        add(cakes('https://www.weddingrule.com/wedding-cakes/new-york/page/2/'), 'Cake & desserts')
    if counts['Hair & makeup'] < MINIMUM:
        beauty = c.fetch('https://loverly.com/planning/wedding-101/best-wedding-hair-makeup-artists-in-us')
        links = list(dict.fromkeys(re.findall(r'href="(/vendors/[^\"]+)"', beauty)))
        with ThreadPoolExecutor(max_workers=4) as pool:
            add(pool.map(schema_profile, [('https://loverly.com'+u, 'Hair & makeup') for u in links]), 'Hair & makeup')
    if counts['Bar services'] < MINIMUM:
        candidates = []
        for city in ('austin', 'houston'):
            u = f'https://www.hiremobilebartenders.com/texas/{city}/'
            schema = next(s for s in c.schemas(c.fetch(u)) if s.get('@type') == 'CollectionPage')
            candidates += [(i['url'], 'Bar services') for i in schema['mainEntity']['itemListElement']]
        with ThreadPoolExecutor(max_workers=4) as pool:
            add(pool.map(schema_profile, candidates), 'Bar services')
    if counts['Transportation'] < MINIMUM:
        candidates = []
        for city in c.CITIES[:5]:
            u = f'https://www.eventective.com/{city}/limos/'
            schema = next(s for s in c.schemas(c.fetch(u)) if s.get('@type') == 'CollectionPage')
            candidates += [dict(url=i['url'], category='Transportation', metro=city)
                           for i in schema['mainEntity']['itemListElement'] if i.get('url')]
        with ThreadPoolExecutor(max_workers=4) as pool:
            add(pool.map(e.checked_profile, candidates), 'Transportation')
    category_names = re.findall(r"'([^']+)'", (ROOT/'lib/categories.js').read_text().split('export const EVENT_TYPES')[0])
    missing = {cat: counts[cat] for cat in category_names if counts[cat] < MINIMUM}
    if missing:
        Path('/private/tmp/vendora-category-progress.json').write_text(json.dumps(records, indent=2))
        raise SystemExit(f'Incomplete categories; primary dataset unchanged: {missing}')
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False)+'\n')
    changed = [r for r in records if before.get(r['source_url']) != r]
    Path('/private/tmp/vendora-category-changes.json').write_text(json.dumps(changed, indent=2))
    print(json.dumps(dict(total=len(records), changed=len(changed), categories=dict(counts)), indent=2))


if __name__ == '__main__':
    main()
