import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVendor } from '@/lib/vendors';
import { getSessionUser } from '@/lib/supabase/server';
import { moneyCents } from '@/lib/format';
import Placeholder from '@/components/ui/Placeholder';
import { VerificationBadge } from '@/components/VendorCard';
import RequestQuote from './RequestQuote';
import Image from 'next/image';
import VendorCalendar from '@/components/VendorCalendar';
import VendorReviews from '@/components/VendorReviews';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const v = await getVendor(id);
  return { title: v ? v.name : 'Vendor' };
}

export default async function VendorProfile({ params }) {
  const { id } = await params;
  const v = await getVendor(id);
  if (!v) notFound();
  const { supabase, user } = await getSessionUser();
  let events = [];
  if (supabase && user && !v.directoryListed) {
    const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false }).limit(30);
    events = data ?? [];
  }

  return (
    <article className="page wrap">
      <header className="page-head">
        <Link href={`/vendors?category=${encodeURIComponent(v.category)}`} className="back-link">{v.category}</Link>
        <h1 className="display-1">{v.name}</h1>
        <div className="row"><VerificationBadge vendor={v} /><span className="small muted">{v.city}{v.serviceRadiusMi ? `, travels up to ${v.serviceRadiusMi} mi` : ''}</span></div>
      </header>
      {v.directoryListed && <p className="listing-status fine"><a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">Public business source ↗</a><span aria-hidden="true"> · </span>Not yet verified by Vendora</p>}

      <div className="profile-layout">
        <div className="stack-lg">
          {v.photos.length ? <section className="stack" aria-label="Portfolio photos">
            <div className="portfolio-cover"><Image src={v.photos[0]} alt={`${v.name} portfolio photo`} fill sizes="(max-width: 900px) 100vw, 65vw" unoptimized priority /></div>
            {v.photos.length > 1 && <div className="portfolio-thumbnails">{v.photos.slice(1).map((photo, i) => <div className="vendor-photo" key={photo}><Image src={photo} alt={`${v.name} portfolio photo ${i + 2}`} fill sizes="(max-width: 760px) 50vw, 22vw" unoptimized /></div>)}</div>}
            {v.sourceUrl && <p className="fine">Photos: <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer">public business listing and its contributors ↗</a></p>}
          </section> : <Placeholder label={v.category} ratio="16 / 9" caption="Portfolio not uploaded yet" />}
          <section className="stack"><h2 className="display-3">About</h2><p className="lede">{v.description || 'This vendor has not written a description yet.'}</p></section>
          <section className="stack"><h2 className="display-3">Packages</h2>
            {v.packages?.length ? (
              <dl>{v.packages.map((p) => (
                <div className="kv" key={`${p.title}-${p.note}`}><dt>{p.title}{p.note && <><br /><span className="fine">{p.note}</span></>}</dt><dd>{p.priceCents != null ? moneyCents(p.priceCents) : v.directoryListed ? 'Published details' : 'Quote'}</dd></div>
              ))}</dl>
            ) : <p className="muted">{v.directoryListed ? 'No packages published. Contact the business for pricing.' : 'No packages listed. Request a quote.'}</p>}
          </section>
          <VendorCalendar entries={v.calendar} />
          <section className="stack"><h2 className="display-3">Setup requirements</h2><p className="muted">{v.setupRequirements || 'Not provided yet.'}</p></section>
          <section className="stack"><h2 className="display-3">Booking and cancellation</h2><p className="muted">{v.bookingPolicy || 'Not provided yet. The vendor’s policy is shown before you confirm any booking.'}</p></section>
          <VendorReviews reviews={v.demoReviews} googleReviewsUrl={v.googleReviewsUrl} sourceUrl={v.sourceUrl} />
        </div>
        <aside className="profile-aside">
          <div className="panel stack">
            <h2 className="title">{v.directoryListed ? 'Contact the business' : 'Request a quote'}</h2>
            <p className="fine">{v.calendarIsDemo ? 'Calendar entries are generated for preview, not supplied by the business. Confirm actual availability directly.' : 'Confirm current prices, policies and availability directly with the business.'}</p>
            {v.directoryListed ? (
              <div className="stack">
                {v.address && <p className="small">{v.address}</p>}
                {v.phone && <a className="small" href={`tel:${v.phone.replace(/[^+\d]/g, '')}`}>{v.phone}</a>}
                {v.website && <a className="btn btn-block" href={v.website} target="_blank" rel="noopener noreferrer">{/(instagram|facebook)\.com/i.test(v.website) ? 'Visit business social page' : 'Visit business website'} ↗</a>}
                {v.instagramUrl && <a className="btn btn-outline" href={v.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
                <a className="btn btn-outline" href={v.googleMapsUrl} target="_blank" rel="noopener noreferrer">Find on Google Maps ↗</a>
                <a className="btn btn-outline" href={v.sourceUrl} target="_blank" rel="noopener noreferrer">View source listing ↗</a>
                <p className="fine">This business has not connected an inbox to Vendora. Contact links open the published destination.</p>
              </div>
            ) : !supabase ? (
              <p className="notice notice-warn">The database is not connected yet.</p>
            ) : !user ? (
              <Link className="btn btn-block" href={`/sign-in?next=/vendors/${v.id}`}>Sign in to request a quote</Link>
            ) : events.length === 0 ? (
              <div className="stack-sm"><p className="small">Create an event first so the vendor sees your date, place and guest count.</p><Link className="btn btn-block" href="/events/new">Create an event</Link></div>
            ) : (
              <RequestQuote vendorId={v.id} vendorName={v.name} events={events} />
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
