import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVendor } from '@/lib/vendors';
import { getSessionUser } from '@/lib/supabase/server';
import { moneyCents } from '@/lib/format';
import Placeholder from '@/components/ui/Placeholder';
import { VerificationBadge } from '@/components/VendorCard';
import RequestQuote from './RequestQuote';

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
  if (supabase && user && !v.sample) {
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

      <div className="profile-layout">
        <div className="stack-lg">
          <Placeholder label={v.category} ratio="16 / 9" caption={v.sample ? 'Sample profile, no portfolio' : 'Portfolio not uploaded yet'} />
          <section className="stack"><h2 className="display-3">About</h2><p className="lede">{v.description || 'This vendor has not written a description yet.'}</p></section>
          <section className="stack"><h2 className="display-3">Packages</h2>
            {v.packages?.length ? (
              <dl>{v.packages.map((p) => (
                <div className="kv" key={p.title}><dt>{p.title}{p.note && <><br /><span className="fine">{p.note}</span></>}</dt><dd>{p.priceCents != null ? moneyCents(p.priceCents) : 'Quote'}</dd></div>
              ))}</dl>
            ) : <p className="muted">No packages listed. Request a quote.</p>}
          </section>
          <section className="stack"><h2 className="display-3">Setup requirements</h2><p className="muted">{v.setupRequirements || 'Not provided yet.'}</p></section>
          <section className="stack"><h2 className="display-3">Booking and cancellation</h2><p className="muted">{v.bookingPolicy || 'Not provided yet. The vendor’s policy is shown before you confirm any booking.'}</p></section>
          <section className="stack"><h2 className="display-3">Reviews</h2><p className="muted">No reviews yet. Reviews appear only from completed bookings.</p></section>
        </div>
        <aside className="profile-aside">
          <div className="panel stack">
            <h2 className="title">Request a quote</h2>
            <p className="fine">The vendor confirms availability in their reply.</p>
            {v.sample ? (
              <p className="notice">This is a sample profile, so quotes are turned off.</p>
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
          {v.sample && <p className="fine">Sample profile for layout only. Prices, availability and policies are placeholders.</p>}
        </aside>
      </div>
    </article>
  );
}
