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
  const date = typeof sp?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : '';
  const { mode, vendors, error } = await listVendors({ category, location });
  const qs = (c) => { const p = new URLSearchParams(); if (c) p.set('category', c); if (location) p.set('location', location); if (date) p.set('date', date); const s = p.toString(); return s ? `/vendors?${s}` : '/vendors'; };
  const count = `${vendors.length} ${mode === 'sample' ? 'sample listings' : vendors.length === 1 ? 'verified vendor' : 'verified vendors'}`;

  return (
    <div className="page wrap">
      <PageHead title={category || 'Find the people who make it.'} lede={`${count}${location ? ` near ${location}` : ''}. Only reviewed businesses appear here.`} />

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
        {mode === 'sample' && <p className="notice">The database is not connected, so these are sample listings for layout only. They are not real vendors, prices or reviews.</p>}
        {date && <p className="notice">Availability on {date} is confirmed by each vendor when you request a quote. Calendars are not connected yet.</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>

      {vendors.length === 0 && !error ? (
        <div className="empty">
          <h2>No {mode === 'sample' ? 'sample' : 'verified'} vendors match yet.</h2>
          <p className="muted small">Try another category or location, or search the wider web. Web results are marked for you to confirm.</p>
          <div className="row"><Link className="btn btn-outline" href="/vendors">Clear filters</Link><Link className="btn btn-outline" href="/discover">Search the web</Link></div>
        </div>
      ) : (
        <ul role="list" className="vendor-grid">{vendors.map((v, i) => <li key={v.id}><VendorCard vendor={v} index={i} /></li>)}</ul>
      )}
    </div>
  );
}
