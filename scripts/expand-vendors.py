"""Maintain at least 750 listings, with 100 within 25 mi of Ann Arbor."""
import concurrent.futures
import importlib.util
import json
import math
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('collector', ROOT / 'scripts/collect-vendors.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
CENTER = (42.2808, -83.7430)
NEARBY = {'ann arbor', 'ypsilanti', 'saline', 'dexter', 'chelsea', 'milan', 'whitmore lake',
          'south lyon', 'canton', 'northville', 'plymouth', 'belleville', 'novi', 'brighton',
          'new hudson', 'pinckney', 'hamburg', 'superior township', 'scio', 'willis',
          'whittaker', 'york', 'pittsfield', 'tecumseh', 'south rockwood'}


def distance(record):
    try:
        lat, lon = math.radians(float(record['latitude'])), math.radians(float(record['longitude']))
        a, b = map(math.radians, CENTER)
        return 3958.7613 * 2 * math.asin(min(1, math.sqrt(math.sin((lat-a)/2)**2 + math.cos(a)*math.cos(lat)*math.sin((lon-b)/2)**2)))
    except (ValueError, TypeError, KeyError):
        return None


def key(r):
    return (re.sub(r'[^a-z0-9]', '', r['name'].lower()), r['city'].lower())


def photo_ok(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=10) as response:
            return response.status == 200 and response.headers.get('Content-Type', '').startswith('image/')
    except Exception:
        return False


def candidate(task):
    slug, page = task
    url = f'https://www.eventective.com/ann-arbor-mi/{slug}/' + (f'?p={page}' if page > 1 else '')
    try:
        schema = next((s for s in c.schemas(c.fetch(url)) if s.get('@type') == 'CollectionPage'), {})
        return [{'url': x['url'], 'category': c.CATEGORIES[slug], 'metro': 'ann-arbor-mi'}
                for x in schema.get('mainEntity', {}).get('itemListElement', [])
                if x.get('url') and x.get('item', {}).get('address', {}).get('addressLocality', '').lower().strip() in NEARBY]
    except Exception:
        return []


def checked_profile(item, local=False):
    r = c.profile(item)
    if not r:
        return None
    if local:
        miles = distance(r)
        if miles is None or miles > 25:
            return None
        r['ann_arbor_distance_mi'] = round(miles, 2)
    good = next((p for p in r['photos'] if photo_ok(p)), None)
    if not good:
        return None
    r['photos'] = [good] + [p for p in r['photos'] if p != good]
    return r


def main():
    output = ROOT / 'data/vendors/public-businesses.json'
    records = json.loads(output.read_text())
    seen_urls, seen_names = {r['source_url'] for r in records}, {key(r) for r in records}
    local_count = sum(distance(r) is not None and distance(r) <= 25 for r in records)
    target = max(750, len(records) + max(0, 100-local_count))
    if len(records) >= 750 and local_count >= 100:
        print(f'Directory already contains {len(records)} businesses and {local_count} within 25 miles of Ann Arbor.', flush=True)
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        groups = list(pool.map(candidate, [(slug, page) for page in range(1, 5) for slug in c.CATEGORIES]))
    items = {}
    for group in groups:
        for item in group:
            items.setdefault(item['url'], item)
    local_candidates = list(items.values()) if local_count < 100 else []
    local_candidates.sort(key=lambda x: '/ann-arbor-mi/' not in x['url'])
    print(f'Researching {len(local_candidates)} local candidates; coordinates determine the 25-mile cutoff.', flush=True)
    for start in range(0, len(local_candidates), 24):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            batch = list(pool.map(lambda item: checked_profile(item, True), local_candidates[start:start+24]))
        for r in batch:
            if r and r['source_url'] not in seen_urls and key(r) not in seen_names:
                records.append(r); seen_urls.add(r['source_url']); seen_names.add(key(r)); local_count += 1
                if local_count == 100:
                    break
        print(f'Local businesses accepted: {local_count}', flush=True)
        if local_count >= 100:
            break
    if local_count < 100:
        Path('/private/tmp/vendora-local-expansion-progress.json').write_text(json.dumps(records, indent=2))
        raise SystemExit(f'Only {local_count} local profiles met the source, photo and distance checks; primary dataset unchanged.')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        national_groups = list(pool.map(c.directory, [(city, slug) for slug in c.CATEGORIES for city in c.CITIES]))
    national, urls = [], set()
    for depth in range(12):
        for group in national_groups:
            if depth < len(group) and group[depth]['url'] not in urls and group[depth]['url'] not in seen_urls:
                urls.add(group[depth]['url']); national.append(group[depth])
    for start in range(0, len(national), 24):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            batch = list(pool.map(checked_profile, national[start:start+24]))
        for r in batch:
            if r and r['source_url'] not in seen_urls and key(r) not in seen_names:
                records.append(r); seen_urls.add(r['source_url']); seen_names.add(key(r))
                if len(records) == target:
                    break
        print(f'Total businesses accepted: {len(records)}', flush=True)
        if len(records) >= target:
            break
    if len(records) < target:
        raise SystemExit(f'Only {len(records)} complete profiles; primary dataset unchanged.')
    output.write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
    print(f'Saved {len(records)} businesses, including {local_count} within 25 miles of Ann Arbor.', flush=True)


if __name__ == '__main__':
    main()
