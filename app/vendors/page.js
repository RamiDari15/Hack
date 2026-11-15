import Link from 'next/link';
import { CATEGORIES, isCategory } from '@/lib/categories';
import { listVendors } from '@/lib/vendors';
import VendorCard from '@/components/VendorCard';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Find vendors' };

export default async function VendorsPage({ searchParams }) {
  const sp = await searchParams;
  const category = isCategory(sp?.category) ? sp.category : '';
  const location = typeof sp?.location === 'string' ? sp.location.slice(0, 80) : '';
  const nearAnnArbor = /^ann\s+arbor(?:,?\s+(?:mi|michigan))?$/i.test(location.trim());
  const date = typeof sp?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : '';
  const page = Math.min(10000, Math.max(1, Number.parseInt(sp?.page, 10) || 1));
  const pageSize = 24;
  const { vendors, error, total } = await listVendors({ category, location, page, pageSize });
  const qs = (c) => { const p = new URLSearchParams(); if (c) p.set('category', c); if (location) p.set('location', location); if (date) p.set('date', date); const s = p.toString(); return s ? `/vendors?${s}` : '/vendors'; };
  const count = `${total} ${total === 1 ? 'vendor' : 'vendors'}`;
  const pageUrl = (n) => { const p = new URLSearchParams(); if (category) p.set('category', category); if (location) p.set('location', location); if (date) p.set('date', date); p.set('page', String(n)); return `/vendors?${p}`; };

  return (
    <div className="page wrap">
      <PageHead title={category || 'Find the people who make it.'} lede={`${count}${nearAnnArbor ? ' within 25 miles of Ann Arbor' : location ? ` near ${location}` : ''}. Browse businesses across the United States.`} />
      <p className="small"><Link href="/vendors?location=Ann%20Arbor">Browse the Ann Arbor area · 25-mile radius</Link></p>

      <form method="get" className="filterbar" aria-label="Filter vendors">
        <div className="field"><label htmlFor="f-cat">Category</label>
          <select id="f-cat" name="category" defaultValue={category}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="f-loc">Location</label><input id="f-loc" name="location" defaultValue={location} placeholder="City" /></div>
        <div className="field"><label htmlFor="f-date">Event date</label><input id="f-date" name="date" type="date" defaultValue={date} /></div>
        <button className="btn" type="submit">Search</button>
      </form>
      <nav className="chips filter-chips" aria-label="Categories">
        <Link className="chip" href={qs('')} aria-current={!category ? 'true' : undefined}>All</Link>
        {CATEGORIES.map((c) => <Link key={c} className="chip" href={qs(c)} aria-current={category === c ? 'true' : undefined}>{c}</Link>)}
      </nav>

      <div className="stack notices">
        <p className="notice">Verified vendors can take inquiries here. Public listings are real businesses we found online: they are not verified by Vendora, so contact them directly to check prices and availability.</p>
        {date && <p className="notice">Your event date is {date}. Availability is confirmed by each vendor, so this date does not filter the list.</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>

      {vendors.length === 0 && !error ? (
        <div className="empty">
          <h2>No vendors match yet.</h2>
          <p className="muted small">Try another category or location, or search the wider web. Web results are marked for you to confirm.</p>
          <div className="row"><Link className="btn btn-outline" href="/vendors">Clear filters</Link><Link className="btn btn-outline" href="/discover">Search the web</Link></div>
        </div>
      ) : (
        <ul role="list" className="vendor-grid">{vendors.map((v, i) => <li key={v.id}><VendorCard vendor={v} index={i} /></li>)}</ul>
      )}
      {total > pageSize && <nav className="between pagination" aria-label="Vendor pages">
        {page > 1 ? <Link className="btn btn-outline" href={pageUrl(page - 1)}>Previous page</Link> : <span />}
        <span className="small">Page {page} of {Math.ceil(total / pageSize)} · {total} vendors</span>
        {page * pageSize < total ? <Link className="btn btn-outline" href={pageUrl(page + 1)}>Next page</Link> : <span />}
      </nav>}
    </div>
  );
}
