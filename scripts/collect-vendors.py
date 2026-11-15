"""Collect public US event-business profiles with source URLs and no invented facts.

Run explicitly; this is not part of app startup. Cache fetched pages for repeatability.
"""
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/private/tmp/vendora-vendor-source-cache')
CACHE.mkdir(exist_ok=True)
CITIES = ['new-york-ny', 'los-angeles-ca', 'chicago-il', 'houston-tx',
          'miami-fl', 'atlanta-ga', 'seattle-wa', 'denver-co', 'phoenix-az', 'boston-ma']
CATEGORIES = {
    'party-event-venues': 'Venues', 'caterers': 'Catering',
    'photographers': 'Photography', 'videographers': 'Videography',
    'florists': 'Florists', 'djs': 'Music & DJ', 'event-planners': 'Planners',
    'party-rentals': 'Rentals', 'bakeries': 'Cake & desserts', 'entertainers': 'Entertainment',
}
# These public profiles currently reference removed cover images (checked Nov 14, 2026).
# Keep them out of a photo-required import rather than showing broken image cards.
UNAVAILABLE_MEDIA = {
    'https://www.eventective.com/somerville-ma/lexus-studios-photo-video-585136.html',
    'https://www.eventective.com/phoenix-az/d-mak-productions-577338.html',
}


def fetch(url):
    cache = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.html')
    if cache.exists():
        return cache.read_text()
    req = urllib.request.Request(url, headers={'User-Agent': 'VendoraDirectoryResearch/1.0'})
    with urllib.request.urlopen(req, timeout=25) as r:
        text = r.read(4_000_000).decode('utf-8', errors='replace')
    cache.write_text(text)
    return text


def schemas(text):
    for raw in re.findall(r'<script[^>]*type=[\"\x27]application/ld\+json[\"\x27][^>]*>(.*?)</script>', text, re.S | re.I):
        try:
            data = json.loads(raw)
            yield from data.get('@graph', [data]) if isinstance(data, dict) else data
        except (ValueError, TypeError):
            continue


def directory(task):
    city, slug = task
    url = f'https://www.eventective.com/{city}/{slug}/'
    try:
        text = fetch(url)
        items = next((s.get('mainEntity', {}).get('itemListElement', []) for s in schemas(text)
                      if s.get('@type') == 'CollectionPage'), [])
        return [{'url': i['url'], 'category': CATEGORIES[slug], 'metro': city}
                for i in items if i.get('url') and i.get('item', {}).get('image')][:12]
    except Exception as e:
        print(f'Directory skipped {url}: {type(e).__name__}', flush=True)
        return []


def profile(candidate):
    url = candidate['url']
    if url in UNAVAILABLE_MEDIA:
        return None
    try:
        text = fetch(url)
        business = next((s for s in schemas(text) if s.get('telephone') or s.get('address')), None)
        if not business or not business.get('name'):
            return None
        address = business.get('address', {})
        if address.get('addressCountry', 'US') not in ('US', 'USA'):
            return None
        same = business.get('sameAs', [])
        same = [same] if isinstance(same, str) else same
        website = next((u for u in same if u.startswith(('http://', 'https://'))
                        and not any(d in u for d in ['instagram.com', 'facebook.com', 'twitter.com'])), None)
        if not website:
            for anchor in re.findall(r'<a\b[^>]*>.*?</a>', text, re.S | re.I):
                if 'PrUrlClick' not in anchor:
                    continue
                match = re.search(r'href=[\"\x27]([^\"\x27]+)', anchor, re.I)
                if match:
                    published = html.unescape(match[1])
                    if published.startswith(('https://', 'http://')) and not re.fullmatch(r'https?://(?:www\.)?instagram.com/?', published):
                        website = published
                        break
        instagram = None
        for u in re.findall(r'href=[\"\x27]([^\"\x27]+)[\"\x27]', text, re.I):
            u = html.unescape(u)
            if 'instagram.com/' in u.lower() and '/eventective' not in u.lower():
                instagram = u if u.startswith(('http://', 'https://')) else 'https://' + u.lstrip('/')
                break
        images = []
        primary = business.get('image', [])
        primary = [primary] if isinstance(primary, str) else primary
        found = primary + re.findall(r'https://media\.eventective\.com/\d+(?:_lg|_md)?\.(?:jpg|png|webp)', text)
        for image in found:
            if isinstance(image, str) and image.startswith('https://media.eventective.com/'):
                image = re.sub(r'_(md|lg)(?=\.)', '', image)
                if image not in images:
                    images.append(image)
        if not images or not website:
            return None
        # A short attributed excerpt, never a copied full marketing description.
        description = ' '.join(html.unescape(business.get('description', '')).split()[:20])
        if description and not description.endswith(('.', '!', '?')):
            description += '…'
        offers = []
        for offer in business.get('makesOffer', [])[:6]:
            price = offer.get('priceSpecification', {})
            offers.append({'title': offer.get('name', 'Published package'),
                           'min': price.get('minPrice', price.get('price')),
                           'max': price.get('maxPrice'), 'unit': price.get('unitCode'),
                           'currency': price.get('priceCurrency', 'USD')})
        return {'source_url': url, 'name': html.unescape(business['name']),
                'category': candidate['category'], 'metro': candidate['metro'],
                'city': ', '.join(filter(None, [address.get('addressLocality'), address.get('addressRegion')])),
                'address': ', '.join(str(address.get(k, '')) for k in
                                     ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode'] if address.get(k)),
                'phone': business.get('telephone'), 'website': website,
                'instagram_url': instagram, 'description': description,
                'photos': images[:4], 'offers': offers,
                'published_hours': business.get('openingHoursSpecification', business.get('openingHours')),
                'latitude': business.get('geo', {}).get('latitude'),
                'longitude': business.get('geo', {}).get('longitude'),
                'collected_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    except Exception as e:
        print(f'Profile skipped {url}: {type(e).__name__}', flush=True)
        return None


def main():
    current = ROOT / 'data/vendors/public-businesses.json'
    if current.exists() and len(json.loads(current.read_text())) >= 750:
        raise SystemExit('The expanded directory is already populated. Use scripts/expand-vendors.py to preserve the 750-business target and local coverage.')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        groups = list(pool.map(directory, [(city, slug) for slug in CATEGORIES for city in CITIES]))
    # Round robin gives each category and metro representation before adding depth.
    candidates, seen = [], set()
    for depth in range(12):
        for group in groups:
            if depth < len(group) and group[depth]['url'] not in seen:
                seen.add(group[depth]['url'])
                candidates.append(group[depth])
    print(f'Found {len(candidates)} distinct candidate profiles.', flush=True)
    result, identities = [], set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for record in pool.map(profile, candidates[:800]):
            if not record:
                continue
            identity = (re.sub(r'[^a-z0-9]', '', record['name'].lower()), record['city'].lower())
            if identity in identities:
                continue
            identities.add(identity)
            result.append(record)
            if len(result) % 50 == 0:
                print(f'Collected {len(result)} business profiles.', flush=True)
            if len(result) == 500:
                break
    output = ROOT / 'data/vendors/public-businesses.json'
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(f'Saved {len(result)} sourced profiles to {output}', flush=True)
    if len(result) != 500:
        raise SystemExit('Collection is incomplete; no database import was performed.')


if __name__ == '__main__':
    main()
