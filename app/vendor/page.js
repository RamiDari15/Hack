import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { BOOKING_STATUS, VENDOR_STATUS, formatDate, moneyCents } from '@/lib/format';
import PageHead from '@/components/PageHead';
import VendorCalendar from '@/components/VendorCalendar';

export const metadata = { title: 'Vendor dashboard' };

export default async function VendorHome() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in/vendor?next=/vendor');

  const [{ data: vendors }, { data: bookings }] = await Promise.all([
    supabase.from('vendors').select('id, name, category, city, verification_status, review_note').eq('owner_id', user.id).order('created_at'),
    supabase.rpc('booking_summaries'),
  ]);
  const mine = vendors ?? [];
  const inbox = (bookings ?? []).filter((b) => b.viewer_is_vendor);

  if (!mine.length) {
    return (
      <div className="page wrap-narrow">
        <PageHead title="Sell your services on Vendora." lede="Apply with your business details. We review every vendor before customers can find you or send inquiries." />
        <div className="row"><Link className="btn" href="/vendor/apply">Apply as a vendor</Link><Link className="btn btn-outline" href="/vendors/join">How it works</Link></div>
      </div>
    );
  }

  const open = inbox.filter((b) => b.status !== 'cancelled' && b.status !== 'confirmed');
  const vendorIds = mine.map(v => v.id);
  const bookingIds = inbox.map(b => b.booking_id);
  const [{data: calendar}, {data: quotes}] = await Promise.all([
    supabase.from('vendor_calendar_entries').select('id,vendor_id,starts_at,ends_at,status,title').in('vendor_id', vendorIds).order('starts_at'),
    bookingIds.length ? supabase.from('quotes').select('amount_cents,status').in('event_vendor_id', bookingIds) : Promise.resolve({data: []}),
  ]);
  const accepted = (quotes ?? []).filter(q => q.status === 'accepted').reduce((sum,q) => sum + Number(q.amount_cents), 0);
  return (
    <div className="page wrap">
      <PageHead title="Your business." lede={open.length ? `${open.length} open ${open.length === 1 ? 'request' : 'requests'} waiting on you or the customer.` : 'No open requests right now.'}>
        <Link className="btn btn-outline" href="/vendor/apply">Add another business</Link>
      </PageHead>

      <section className="panel row" aria-label="Business overview">
        <p><strong>{open.length}</strong> open requests</p>
        <p><strong>{inbox.filter(b => b.status === 'confirmed').length}</strong> confirmed events</p>
        <p><strong>{moneyCents(accepted)}</strong> in accepted quotes</p>
        <Link className="btn btn-sm btn-outline" href="/inbox?view=vendor">Open business inbox</Link>
      </section>

      <section className="stack" aria-labelledby="biz-h">
        <h2 id="biz-h" className="display-3">Profiles</h2>
        <ul role="list" className="booking-list panel">
          {mine.map((v) => {
            const s = VENDOR_STATUS[v.verification_status] ?? VENDOR_STATUS.pending;
            return (
              <li key={v.id}>
                <div className="stack-sm">
                  <Link className="title" href={`/vendor/profile/${v.id}`}>{v.name}</Link>
                  <p className="fine">{v.category}{v.city ? `, ${v.city}` : ''}</p>
                  {v.verification_status === 'rejected' && v.review_note && <p className="small">Reviewer’s note: {v.review_note}</p>}
                </div>
                <div className="row">
                  <span className={`badge ${s.tone}`}>{s.label}</span>
                  <Link className="btn btn-sm btn-outline" href={`/vendor/profile/${v.id}`}>Edit</Link>
                  {v.verification_status === 'verified' && <Link className="btn btn-sm btn-outline" href={`/vendors/${v.id}`}>Public page</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {mine.map(v => <div className="panel stack" key={`calendar-${v.id}`}>
        {mine.length > 1 && <h2>{v.name}</h2>}
        <VendorCalendar entries={(calendar ?? []).filter(entry => entry.vendor_id === v.id)} headingId={`schedule-${v.id}`} />
      </div>)}

      <section className="stack" aria-labelledby="inbox-h">
        <h2 id="inbox-h" className="display-3">Requests</h2>
        {inbox.length ? (
          <ol role="list" className="event-list">
            {inbox.map((b) => {
              const s = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry;
              return (
                <li key={b.booking_id}>
                  <Link href={`/bookings/${b.booking_id}`} className="event-row">
                    <span className="event-date">
                      {b.event_date ? <><b>{formatDate(b.event_date, { day: 'numeric' })}</b><span>{formatDate(b.event_date, { month: 'short', year: 'numeric' })}</span></> : <span>Date not set</span>}
                    </span>
                    <span className="event-main">
                      <span className="title">{b.event_type}{b.guest_count ? ` for ${b.guest_count}` : ''}</span>
                      <span className="small muted">{b.location || 'Location not set'}, for {b.vendor_name}</span>
                    </span>
                    <span className="event-meta"><span className={`badge ${s.tone}`}>{s.label}</span></span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty"><h3>No requests yet</h3><p className="muted small">Customers can send inquiries once your profile is verified.</p></div>
        )}
      </section>
    </div>
  );
}
