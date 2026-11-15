/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, moneyCents } from '@/lib/format';
import { loadShortlist } from '@/lib/shortlist';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Compare vendors' };

// Side-by-side compare of 2 to 4 shortlisted vendors. Every cell is what the business publishes
// or what happened on Vendora (quotes, votes); empty cells say so instead of guessing.
export default async function CompareVendorsPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/shortlist`);
  const { data: event } = await supabase.from('events').select('id, title, location, guest_count').eq('id', id).maybeSingle();
  if (!event) notFound();
  const wanted = [].concat(sp?.ids ?? []).filter((x) => UUID_RE.test(x)).slice(0, 4);
  if (wanted.length < 2) redirect(`/events/${id}/shortlist?compare=few`);
  const { items } = await loadShortlist(supabase, id, event);
  const cols = wanted.map((w) => items.find((i) => i.id === w)).filter(Boolean);
  if (cols.length < 2) redirect(`/events/${id}/shortlist?compare=few`);

  const cheapest = Math.min(...cols.map((c) => c.quote?.amount_cents ?? c.lowest?.cents ?? Infinity));
  const nearest = Math.min(...cols.map((c) => c.distanceMi ?? Infinity));
  const none = <span className="muted">Not published</span>;
  const rows = [
    ['Photos', (c) => (c.photo ? <img className="compare-photo" src={c.photo} alt={`${c.name} portfolio`} loading="lazy" /> : <span className="muted">No photos</span>)],
    ['Status', (c) => <span className={`badge ${c.verified ? 'badge-ok' : 'badge-plain'}`}>{c.verified ? 'Verified by Vendora' : 'Public listing, not verified'}</span>],
    ['Category', (c) => c.category],
    ['Location', (c) => <>{c.city ?? 'Not listed'}{c.distanceMi != null && <span className={`block fine${c.distanceMi === nearest ? ' text-ok' : ''}`}>{c.distanceMi} mi from Ann Arbor{c.distanceMi === nearest ? ', nearest' : ''}</span>}{c.serviceRadius ? <span className="block fine">Travels {c.serviceRadius} mi</span> : null}</>],
    ['Price', (c) => (
      <>
        {c.quote ? <b className="num">{moneyCents(c.quote.amount_cents)} <span className="fine">{c.quote.status === 'accepted' ? 'accepted quote' : 'quote'}</span></b> : null}
        {c.lowest ? <span className="block num">Published from {moneyCents(c.lowest.cents)}{c.lowest.unit !== 'event' ? ` / ${c.lowest.unit}` : ''}</span> : !c.quote && none}
        {(c.quote?.amount_cents ?? c.lowest?.cents) === cheapest && cols.length > 1 && <span className="badge badge-ok">Lowest here</span>}
      </>
    )],
    ['Services', (c) => (c.services.length ? <ul className="plain-list">{c.services.map((s) => <li key={s.title}>{s.title}{s.cents != null ? ` · ${moneyCents(s.cents)}` : ''}</li>)}</ul> : none)],
    ['Cancellation and booking policy', (c) => c.policy || none],
    ['Setup needs', (c) => c.setup || none],
    ['About', (c) => (c.description ? <span className="small">{c.description.slice(0, 280)}{c.description.length > 280 ? '…' : ''}</span> : none)],
    ['Team votes', (c) => <>{c.up} yes · {c.down} no{c.voters.length ? <span className="block fine">{c.voters.map((v) => `${v.name} ${v.vote > 0 ? 'yes' : 'no'}`).join(', ')}</span> : null}</>],
    ['Comments', (c) => (c.comments.length ? <ul className="plain-list small">{c.comments.slice(-3).map((m) => <li key={m.id}><b>{m.author}</b> {m.body}</li>)}</ul> : <span className="muted">None yet</span>)],
    ['', (c) => (
      <div className="stack-sm">
        <Link className="btn btn-sm btn-outline" href={`/vendors/${c.vendorId}`}>Open profile</Link>
        {c.booking ? <Link className="btn btn-sm btn-outline" href={`/bookings/${c.booking.id}`}>Conversation</Link> : c.website && <a className="btn btn-sm btn-outline" href={c.website} target="_blank" rel="noopener noreferrer nofollow">Website<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
    )],
  ];

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}/shortlist`, label: 'Shortlist' }} title="Compare side by side" size="display-2"
        lede={`${cols.length} vendors for ${event.title}. Prices are what each business publishes or quoted you; confirm details with them.`} />
      <div className="table-wrap panel">
        <table className="table compare-vendors" style={{ '--cols': cols.length }}>
          <caption className="sr-only">Vendors compared by price, services, distance, photos and policies</caption>
          <thead><tr><th scope="col"><span className="sr-only">Detail</span></th>{cols.map((c) => <th key={c.id} scope="col"><Link href={`/vendors/${c.vendorId}`}>{c.name}</Link></th>)}</tr></thead>
          <tbody>
            {rows.map(([label, cell]) => (
              <tr key={label || 'actions'}><th scope="row">{label}</th>{cols.map((c) => <td key={c.id}>{cell(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
