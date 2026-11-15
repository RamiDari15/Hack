import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, BOOKING_STATUS, formatDate, moneyCents } from '@/lib/format';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Compare quotes' };

const QUOTE = { sent: { label: 'Waiting for you', tone: 'badge-info' }, accepted: { label: 'Accepted', tone: 'badge-ok' }, declined: { label: 'Declined', tone: 'badge-plain' }, expired: { label: 'Expired', tone: 'badge-plain' } };

// Side-by-side quote comparison, one row per category. Every number is the vendor's own quote,
// compared with the event's AI estimate for that category.
export default async function CompareQuotesPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/quotes`);

  const [{ data: event }, { data: bookings }, { data: plans }] = await Promise.all([
    supabase.from('events').select('id, title, guest_count, budget_cents').eq('id', id).maybeSingle(),
    supabase.from('event_vendors').select('id, status, vendors(id, name, category, city, verification_status), quotes(id, amount_cents, description, valid_until, status, created_at)').eq('event_id', id),
    supabase.from('ai_requests').select('output').eq('event_id', id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
  ]);
  if (!event) notFound();
  const estimate = Object.fromEntries((plans?.[0]?.output?.categories ?? []).map((c) => [c.name, c]));
  const showOld = sp?.all === '1';

  // Latest quote per booking (or all of them when asked), grouped by category.
  const groups = {};
  for (const b of bookings ?? []) {
    const qs = [...(b.quotes ?? [])].sort((a, c) => c.created_at.localeCompare(a.created_at));
    const shown = showOld ? qs : qs.filter((q) => q.status === 'sent' || q.status === 'accepted').slice(0, 1);
    for (const q of shown) (groups[b.vendors?.category ?? 'Other'] ??= []).push({ ...q, booking: b });
  }
  const cats = Object.keys(groups).sort();

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Compare quotes" size="display-2"
        lede="Every quote side by side, by category, against your AI estimate." >
        <Link className="btn btn-sm btn-outline" href={showOld ? `/events/${event.id}/quotes` : `/events/${event.id}/quotes?all=1`}>{showOld ? 'Show current quotes only' : 'Include declined and expired'}</Link>
      </PageHead>

      {cats.length ? cats.map((cat) => {
        const qs = groups[cat].sort((a, b) => a.amount_cents - b.amount_cents);
        const est = estimate[cat];
        const low = Math.min(...qs.map((q) => q.amount_cents));
        return (
          <section key={cat} className="stack compare-section" aria-labelledby={`c-${cat}`}>
            <div className="between">
              <h2 id={`c-${cat}`} className="display-3">{cat}</h2>
              {est && <p className="small">AI estimate <b className="num">{moneyCents(est.low * 100)}–{moneyCents(est.high * 100)}</b></p>}
            </div>
            <div className="table-wrap panel">
              <table className="table compare-table">
                <thead>
                  <tr><th scope="col">Vendor</th><th scope="col">Quote</th><th scope="col">Vs. estimate</th>{event.guest_count ? <th scope="col">Per guest</th> : null}<th scope="col">Valid until</th><th scope="col">Includes</th><th scope="col">Status</th></tr>
                </thead>
                <tbody>
                  {qs.map((q) => {
                    const st = QUOTE[q.status] ?? QUOTE.sent;
                    const diff = est ? q.amount_cents - est.high * 100 : null;
                    return (
                      <tr key={q.id}>
                        <th scope="row">
                          <Link href={`/bookings/${q.booking.id}`}>{q.booking.vendors?.name}</Link>
                          <span className="fine block">{(BOOKING_STATUS[q.booking.status] ?? BOOKING_STATUS.inquiry).label}{q.booking.vendors?.verification_status === 'verified' ? ', verified' : ''}</span>
                        </th>
                        <td className="num">{moneyCents(q.amount_cents)}{q.amount_cents === low && qs.length > 1 && <span className="badge badge-ok block-badge">Lowest</span>}</td>
                        <td className="num">{diff == null ? '—' : diff > 0 ? <span className="text-warn">{moneyCents(diff)} over</span> : q.amount_cents < est.low * 100 ? 'Below range' : 'Within range'}</td>
                        {event.guest_count ? <td className="num">{moneyCents(Math.round(q.amount_cents / event.guest_count))}</td> : null}
                        <td>{q.valid_until ? formatDate(q.valid_until) : '—'}</td>
                        <td className="small">{q.description || '—'}</td>
                        <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {qs.some((q) => q.status === 'sent') && <p className="fine">Accept or decline from each vendor’s conversation. Nothing is booked until you confirm.</p>}
          </section>
        );
      }) : (
        <div className="panel empty"><h3>No quotes yet</h3><p className="muted small">Quotes appear here as vendors reply to your requests.</p>
          <Link className="btn btn-sm" href={`/events/${event.id}/choose`}>Choose vendors</Link></div>
      )}
      <p className="fine">Amounts are the vendors’ own quotes. Per-guest figures divide the quote by your event’s guest count.</p>
    </div>
  );
}
