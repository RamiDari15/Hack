import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, BOOKING_STATUS, formatDate, moneyCents } from '@/lib/format';
import { sendMessage, sendQuote, placeHold, confirmBooking, cancelBooking, respondToQuote } from '@/app/actions/marketplace';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';

export const metadata = { title: 'Booking' };

const QUOTE_STATUS = {
  sent: { label: 'Waiting for answer', tone: 'badge-info' },
  accepted: { label: 'Accepted', tone: 'badge-ok' },
  declined: { label: 'Declined', tone: 'badge-plain' },
  expired: { label: 'Expired', tone: 'badge-plain' },
};

const time = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Detroit' });

export default async function BookingPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/bookings/${id}`);

  const [{ data: rows }, { data: quotes }, { data: messages }, { data: times }] = await Promise.all([
    supabase.rpc('booking_summaries', { only_booking: id }),
    supabase.from('quotes').select('id, amount_cents, description, valid_until, status, created_at').eq('event_vendor_id', id).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, sender_id, body, created_at').eq('event_vendor_id', id).order('created_at'),
    supabase.from('event_timeline_items').select('id, start_time, end_time, title, notes, source').eq('event_vendor_id', id).order('start_time'),
  ]);
  const b = rows?.[0];
  if (!b) notFound();

  const isVendor = b.viewer_is_vendor;
  const isOwner = b.viewer_is_owner;
  const st = BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry;
  const open = b.status !== 'cancelled' && b.status !== 'confirmed';
  const accepted = (quotes ?? []).find((q) => q.status === 'accepted');
  const other = isVendor ? 'Organizer' : b.vendor_name;
  const meta = [formatDate(b.event_date), b.location, b.guest_count ? `${b.guest_count} guests` : null].filter(Boolean).join(', ');

  return (
    <div className="page wrap">
      <PageHead
        back={isVendor ? { href: '/vendor', label: 'Vendor dashboard' } : { href: `/events/${b.event_id}`, label: 'Back to the event' }}
        title={isVendor ? `${b.event_type} request.` : b.vendor_name}
        lede={isVendor ? meta : `${b.vendor_category}. ${meta}`}
      >
        <span className={`badge ${st.tone}`}>{st.label}</span>
        {b.status === 'hold' && b.hold_expires_at && <span className="badge badge-warn">Held until {formatDate(b.hold_expires_at)}</span>}
        {!isVendor && <Link className="btn btn-sm btn-outline" href={`/vendors/${b.vendor_id}`}>Vendor profile</Link>}
      </PageHead>
      {isVendor && b.style && <p className="muted">Style: {b.style}</p>}

      <div className="event-layout">
        <section className="panel stack" aria-labelledby="msg-h">
          <h2 id="msg-h">Messages</h2>
          {messages?.length ? (
            <ol role="list" className="thread">
              {messages.map((m) => {
                const mine = m.sender_id === user.id;
                return (
                  <li key={m.id} className={`bubble${mine ? ' bubble-mine' : ''}`}>
                    <p className="fine">{mine ? 'You' : other}, {time(m.created_at)}</p>
                    <p className="bubble-body">{m.body}</p>
                  </li>
                );
              })}
            </ol>
          ) : <p className="muted small">No messages yet. Ask about the date, setup or what is included.</p>}
          {b.status !== 'cancelled' && (
            <ActionForm action={sendMessage} resetOnOk>
              <input type="hidden" name="booking_id" value={id} />
              <div className="field"><label htmlFor="msg-body">Message to {other}</label><textarea id="msg-body" name="body" maxLength={4000} required /></div>
              <button className="btn" type="submit">Send message</button>
            </ActionForm>
          )}
        </section>

        <div className="stack-lg">
          {times?.length > 0 && (
            <section className="panel stack-sm" aria-labelledby="times-h">
              <h2 id="times-h">On the day</h2>
              <ul role="list" className="stack-sm">
                {times.map((t) => (
                  <li key={t.id} className="small"><b className="num">{t.start_time.slice(0, 5)}{t.end_time ? `–${t.end_time.slice(0, 5)}` : ''}</b> {t.title}{t.source === 'ai' ? <span className="badge badge-warn" style={{ marginLeft: 8 }}>Draft, confirm</span> : null}{t.notes ? <span className="fine block">{t.notes}</span> : null}</li>
                ))}
              </ul>
              <p className="fine">From the organizer’s day-of timeline. Reply in messages if a time does not work.</p>
            </section>
          )}
          <section className="panel stack" aria-labelledby="quotes-h">
            <h2 id="quotes-h">Quotes</h2>
            {quotes?.length ? (
              <ul role="list" className="booking-list">
                {quotes.map((q) => {
                  const qs = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.sent;
                  return (
                    <li key={q.id} className="stack-sm">
                      <div className="between" style={{ width: '100%' }}>
                        <span className="row"><span className="badge badge-accent">Vendor quote</span><b className="num">{moneyCents(q.amount_cents)}</b></span>
                        <span className={`badge ${qs.tone}`}>{qs.label}</span>
                      </div>
                      {q.description && <p className="small">{q.description}</p>}
                      <p className="fine">Sent {formatDate(q.created_at)}{q.valid_until ? `, valid until ${formatDate(q.valid_until)}` : ''}</p>
                      {isOwner && q.status === 'sent' && open && (
                        <div className="row">
                          <ActionForm action={respondToQuote}>
                            <input type="hidden" name="quote_id" value={q.id} /><input type="hidden" name="booking_id" value={id} /><input type="hidden" name="decision" value="accept" />
                            <button className="btn btn-sm" type="submit">Accept quote</button>
                          </ActionForm>
                          <ActionForm action={respondToQuote}>
                            <input type="hidden" name="quote_id" value={q.id} /><input type="hidden" name="booking_id" value={id} /><input type="hidden" name="decision" value="decline" />
                            <button className="btn btn-sm btn-outline" type="submit">Decline</button>
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted small">{isVendor ? 'Send a quote so the customer can compare it with their estimate.' : 'No quote yet. The vendor has the event details you shared.'}</p>}

            {isVendor && open && b.status !== 'hold' && (
              <ActionForm action={sendQuote} resetOnOk>
                <input type="hidden" name="booking_id" value={id} />
                {quotes?.length > 0 && <h3 className="title">Send a revised quote</h3>}
                <div className="field"><label htmlFor="q-amount">Quote amount (USD)</label><input id="q-amount" name="amount" inputMode="decimal" required placeholder="4800" /></div>
                <div className="field"><label htmlFor="q-desc">What it includes</label><textarea id="q-desc" name="description" maxLength={2000} /></div>
                <div className="field"><label htmlFor="q-valid">Valid until</label><input id="q-valid" name="valid_until" type="date" /></div>
                <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /><span>Send this quote to the customer. It is not a booking until they accept and confirm.</span></label>
                <button className="btn" type="submit">Send quote</button>
              </ActionForm>
            )}
          </section>

          {open && (
            <section className="panel stack" aria-labelledby="next-h">
              <h2 id="next-h">Next step</h2>
              {isVendor && b.status === 'quote' && (
                <ActionForm action={placeHold}>
                  <input type="hidden" name="booking_id" value={id} />
                  <p className="small">Hold the date while the customer decides.</p>
                  <div className="field"><label htmlFor="h-days">Hold for</label>
                    <select id="h-days" name="days" defaultValue="7">{[3, 7, 14].map((d) => <option key={d} value={d}>{d} days</option>)}</select></div>
                  <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /><span>Hold this date for the customer.</span></label>
                  <button className="btn btn-outline" type="submit">Place hold</button>
                </ActionForm>
              )}
              {isVendor && b.status === 'inquiry' && <p className="small muted">Send a quote first. Then you can hold the date.</p>}
              {isVendor && b.status === 'hold' && <p className="small muted">The date is on hold. The customer confirms once they accept your quote.</p>}
              {isOwner && (accepted ? (
                <ActionForm action={confirmBooking}>
                  <input type="hidden" name="booking_id" value={id} />
                  <p className="small">You accepted {moneyCents(accepted.amount_cents)}. Confirming tells {b.vendor_name} to plan on your date. No payment is taken in Vendora.</p>
                  <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /><span>Confirm this booking with {b.vendor_name}.</span></label>
                  <button className="btn" type="submit">Confirm booking</button>
                </ActionForm>
              ) : <p className="small muted">Accept a quote to confirm the booking.</p>)}
            </section>
          )}
          {b.status === 'confirmed' && <p className="notice notice-ok">Booking confirmed{accepted ? ` at ${moneyCents(accepted.amount_cents)}` : ''}. Arrange payment directly with {isVendor ? 'the organizer' : b.vendor_name}.</p>}

          {b.status !== 'cancelled' && (isOwner || isVendor) && (
            <details className="disclosure">
              <summary>Cancel this booking</summary>
              <ActionForm action={cancelBooking}>
                <input type="hidden" name="booking_id" value={id} />
                <label className="check-row"><input type="checkbox" name="confirm" value="yes" required /><span>Cancel. {isVendor ? 'The organizer' : b.vendor_name} is told right away. This cannot be undone.</span></label>
                <button className="btn btn-sm btn-outline" type="submit">Cancel booking</button>
              </ActionForm>
            </details>
          )}
          {b.status === 'cancelled' && <p className="notice">This booking was cancelled.</p>}
        </div>
      </div>
    </div>
  );
}
