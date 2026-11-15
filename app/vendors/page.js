import { getSessionUser } from '@/lib/supabase/server';
import Link from 'next/link';
import { CATEGORIES, isCategory } from '@/lib/categories';
import { listVendors } from '@/lib/vendors';
import VendorCard from '@/components/VendorCard';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Find vendors' };

const PRICE_CAPS = [500, 1000, 2500, 5000, 10000];

export default async function VendorsPage({ searchParams }) {
  const sp = await searchParams;
  const category = isCategory(sp?.category) ? sp.category : '';
  const location = typeof sp?.location === 'string' ? sp.location.slice(0, 80) : '';
  const nearAnnArbor = /^ann\s+arbor(?:,?\s+(?:mi|michigan))?$/i.test(location.trim());
  const date = typeof sp?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : '';
  const page = Math.min(10000, Math.max(1, Number.parseInt(sp?.page, 10) || 1));
  const pageSize = 24;
  const verifiedOnly = sp?.verified === '1';
  const hasPhotos = sp?.photos === '1';
  const radius = [10, 25, 50].includes(Number(sp?.radius)) ? Number(sp.radius) : 25;
  const maxPrice = PRICE_CAPS.includes(Number(sp?.max)) ? Number(sp.max) : null;
  const sort = ['recommended', 'price', 'distance'].includes(sp?.sort) ? sp.sort : 'recommended';
  const { vendors, error, total, capped } = await listVendors({ category, location, page, pageSize, verifiedOnly, hasPhotos, radius, maxPriceCents: maxPrice == null ? null : maxPrice * 100, sort });
  const {supabase,user}=await getSessionUser();
  const [{data:eventRows},{data:savedRows}]=supabase&&user?await Promise.all([
    supabase.from('events').select('id,title,guest_count').order('created_at',{ascending:false}).limit(30),
    supabase.from('saved_vendors').select('vendor_id'),
  ]):[{data:[]},{data:[]}];
  const events=eventRows||[],savedIds=new Set((savedRows||[]).map(r=>r.vendor_id));
  const selectedEvent=events.find(e=>e.id===sp?.event);
  const current = { event: selectedEvent?.id||'', category, location, date, verified: verifiedOnly ? '1' : '', photos: hasPhotos ? '1' : '', radius: nearAnnArbor && radius !== 25 ? String(radius) : '', max: maxPrice ? String(maxPrice) : '', sort: sort === 'recommended' ? '' : sort };
  const build = (over) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ ...current, ...over })) if (v) p.set(k, v); const q = p.toString(); return q ? `/vendors?${q}` : '/vendors'; };
  const qs = (c) => build({ category: c, page: '' });
  const pageUrl = (n) => build({ page: String(n) });
  const count = `${total} ${total === 1 ? 'vendor' : 'vendors'}`;
  const activeFilters = [verifiedOnly && 'verified only', hasPhotos && 'with photos', maxPrice && `published price from $${maxPrice.toLocaleString('en-US')} or less`].filter(Boolean);

  return (
    <div className="page wrap pg pg-vendors">
      <PageHead title={category || 'Find the people who make it.'} lede={`${count}${activeFilters.length ? `, ${activeFilters.join(', ')}` : ''}${nearAnnArbor ? ` within ${radius} miles of Ann Arbor` : location ? ` near ${location}` : ''}.`}>
        <Link className="small" href="/vendors?location=Ann%20Arbor">Browse the Ann Arbor area · 25-mile radius</Link>
      </PageHead>
      {selectedEvent&&<p className="notice notice-sun">Planning for <Link href={`/events/${selectedEvent.id}`}>{selectedEvent.title}</Link>. Add any vendor to its shortlist.</p>}

      <form method="get" className="filterbar" aria-label="Filter vendors">
        {selectedEvent&&<input type="hidden" name="event" value={selectedEvent.id}/>}
        <div className="field"><label htmlFor="f-cat">Category</label>
          <select id="f-cat" name="category" defaultValue={category}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="f-loc">Location</label><input id="f-loc" name="location" defaultValue={location} placeholder="City" /></div>
        <div className="field"><label htmlFor="f-date">Event date</label><input id="f-date" name="date" type="date" defaultValue={date} /></div>
        <button className="btn" type="submit">Search</button>
        <details className="filter-more" open={Boolean(activeFilters.length || current.radius || current.sort) || undefined}>
          <summary>More filters</summary>
          <div className="filter-grid">
            <div className="field"><label htmlFor="f-max">Published price up to</label>
              <select id="f-max" name="max" defaultValue={maxPrice ?? ''}><option value="">Any price</option>{PRICE_CAPS.map((c) => <option key={c} value={c}>${c.toLocaleString('en-US')}</option>)}</select></div>
            <div className="field"><label htmlFor="f-radius">Distance (Ann Arbor area)</label>
              <select id="f-radius" name="radius" defaultValue={String(radius)}>{[10, 25, 50].map((r) => <option key={r} value={r}>Within {r} miles</option>)}</select></div>
            <div className="field"><label htmlFor="f-sort">Sort</label>
              <select id="f-sort" name="sort" defaultValue={sort}><option value="recommended">Verified first</option><option value="price">Lowest published price</option><option value="distance">Nearest (Ann Arbor area)</option></select></div>
            <div className="stack-sm">
              <label className="check-row"><input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} /><span>Verified by Vendora only</span></label>
              <label className="check-row"><input type="checkbox" name="photos" value="1" defaultChecked={hasPhotos} /><span>Has photos</span></label>
            </div>
          </div>
          <p className="fine">Filters use each business’s published starting price. Places with no listed price are hidden.</p>
        </details>
      </form>
      <nav className="chips filter-chips" aria-label="Categories">
        <Link className="chip" href={qs('')} aria-current={!category ? 'true' : undefined}>All</Link>
        {CATEGORIES.map((c) => <Link key={c} className="chip" href={qs(c)} aria-current={category === c ? 'true' : undefined}>{c}</Link>)}
      </nav>

      <div className="stack notices">
        <p className="fine directory-note">Verified vendors take inquiries right here. Public listings are businesses we found online, so reach out to them directly.</p>
        {date && <p className="notice">Your event date is {date}. Availability is confirmed by each vendor, so this date does not filter the list.</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {capped && <p className="notice">Price filters looked at the first 600 matches. Narrow by category or location for a complete list.</p>}
      </div>

      {vendors.length === 0 && !error ? (
        <div className="empty">
          <h2>No vendors match yet.</h2>
          <p className="muted small">Try another category or place, or search the web.</p>
          <div className="row"><Link className="btn btn-outline" href="/vendors">Clear filters</Link><Link className="btn btn-outline" href="/ideas">Explore ideas</Link></div>
        </div>
      ) : (
        <ul role="list" className="vendor-grid">{vendors.map((v, i) => <li key={v.id}><VendorCard vendor={v} index={i} showDistance={nearAnnArbor} signedIn={Boolean(user)} events={events} saved={savedIds.has(v.id)} eventId={selectedEvent?.id} /></li>)}</ul>
      )}
      {total > pageSize && <nav className="between pagination" aria-label="Vendor pages">
        {page > 1 ? <Link className="btn btn-outline" href={pageUrl(page - 1)}>Previous page</Link> : <span />}
        <span className="small">Page {page} of {Math.ceil(total / pageSize)} · {total} vendors</span>
        {page * pageSize < total ? <Link className="btn btn-outline" href={pageUrl(page + 1)}>Next page</Link> : <span />}
      </nav>}
    </div>
  );
}
