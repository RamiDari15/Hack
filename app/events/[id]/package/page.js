import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, moneyCents } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import { loadShortlist, pickCost } from '@/lib/shortlist';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { setPackagePick } from '@/app/actions/shared';
import TradeOffs from './TradeOffs';

export const metadata = { title: 'Event package' };

const PER_GUEST = ['Catering', 'Bar services', 'Cake & desserts', 'Rentals'];
const OPTIONAL = ['Videography', 'Photo booth', 'Decor & styling', 'Entertainment', 'Transportation', 'Hair & makeup'];

// The complete package: one chosen vendor per category with its cost and where that cost came
// from, AI estimates for everything not chosen yet, and the total against the budget.
export default async function PackagePage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/package`);
  const [{ data: event }, { data: plans }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, location, guest_count, budget_cents, starter_plan').eq('id', id).maybeSingle(),
    supabase.from('ai_requests').select('output').eq('event_id', id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const { items } = await loadShortlist(supabase, id, event);
  const picks = Object.fromEntries(items.filter((i) => i.inPackage).map((i) => [i.category, i]));
  const estimates = (plans?.[0]?.output ?? event.starter_plan)?.categories ?? [];

  const names = [...new Set([...estimates.map((c) => c.name), ...Object.keys(picks)])];
  const rows = names.map((name) => {
    const pick = picks[name];
    const est = estimates.find((c) => c.name === name);
    const cost = pick ? pickCost(pick, event.guest_count) : null;
    if (pick && cost) return { name, kind: 'pick', vendor: pick.name, item: pick, fixedCents: cost.cents, source: cost.source, perPersonPick: cost.source.startsWith('Published per-person'), optional: OPTIONAL.includes(name) };
    if (est) return { name, kind: 'estimate', lowCents: Math.round(est.low * 100), highCents: Math.round(est.high * 100), perGuest: PER_GUEST.includes(name), optional: OPTIONAL.includes(name), pending: pick ?? null };
    return { name, kind: 'unpriced', item: pick };
  });
  const priced = rows.filter((r) => r.kind !== 'unpriced');
  const chosenTotal = priced.filter((r) => r.kind === 'pick').reduce((n, r) => n + r.fixedCents, 0);
  const estLow = priced.filter((r) => r.kind === 'estimate').reduce((n, r) => n + r.lowCents, 0);
  const estHigh = priced.filter((r) => r.kind === 'estimate').reduce((n, r) => n + r.highCents, 0);
  const missing = CATEGORIES.filter((c) => estimates.some((e) => e.name === c) && !picks[c]);
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap ev">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Your event package" size="display-2"
        lede="One vendor per category, the combined cost, and how it sits against your budget.">
        <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/shortlist`}>Shortlist</Link>
      </PageHead>

      <dl className="stat-strip">
        <div><dt>Budget</dt><dd className="num">{moneyCents(event.budget_cents)}</dd></div>
        <div><dt>Chosen vendors</dt><dd className="num">{moneyCents(chosenTotal)}</dd></div>
        <div><dt>Still a ballpark</dt><dd className="num">{moneyCents(estLow)}–{moneyCents(estHigh)}</dd></div>
        <div><dt>Projected total</dt><dd className="num">{moneyCents(chosenTotal + estLow)}–{moneyCents(chosenTotal + estHigh)}</dd></div>
      </dl>
      {event.budget_cents != null && chosenTotal + estLow > event.budget_cents && <p className="notice notice-warn">Even at the low end of the ballparks, this package is over budget. Try the trade-offs below.</p>}

      <div>
        <div className="stack-lg">
          <section className="panel stack" aria-labelledby="pk-h">
            <h2 id="pk-h" className="ev-panel-title">Package</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Package by category with the source of each amount</caption>
                <thead><tr><th scope="col">Category</th><th scope="col">Vendor</th><th scope="col">Source</th><th scope="col" className="num">Amount</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.kind === 'pick' || r.kind === 'unpriced' ? <Link href={`/vendors/${r.item.vendorId}`}>{r.item.name}</Link> : r.pending ? r.pending.name : CATEGORIES.includes(r.name) ? <Link href={`/events/${event.id}/choose?step=${encodeURIComponent(r.name)}`} className="fine">Choose one</Link> : <span className="fine">—</span>}</td>
                      <td>{r.kind === 'pick' ? <span className="source is-quote">{r.source}</span> : r.kind === 'estimate' ? <span className="source">{r.pending ? 'No price yet, using the ballpark' : (plans?.length?'Ballpark':'Planning range')}</span> : <span className="source">No price yet</span>}</td>
                      <td className="num">
                        {r.kind === 'pick' ? moneyCents(r.fixedCents) : r.kind === 'estimate' ? `${moneyCents(r.lowCents)}–${moneyCents(r.highCents)}` : '—'}
                        {isOwner && (r.kind === 'unpriced' || r.pending || (r.kind === 'pick' && r.source === 'Your planned amount')) && (
                          <ActionForm action={setPackagePick} className="row planned-form">
                            {hidden}<input type="hidden" name="id" value={(r.item ?? r.pending).id} />
                            <label className="sr-only" htmlFor={`pl-${(r.item ?? r.pending).id}`}>Planned amount for {(r.item ?? r.pending).name}</label>
                            <input id={`pl-${(r.item ?? r.pending).id}`} name="planned" inputMode="decimal" placeholder="Planned $" defaultValue={(r.item ?? r.pending).plannedCents != null ? (r.item ?? r.pending).plannedCents / 100 : ''} />
                            <button className="btn btn-sm btn-outline" type="submit">Set</button>
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <div className="empty"><h3>Nothing to total yet</h3><p className="muted small">Build a plan, then pick vendors from your shortlist.</p></div>}
            {missing.length > 0 && <p className="fine">Not chosen yet: {missing.join(', ')}. <Link href={`/events/${event.id}/choose`}>Choose vendors</Link> and shortlist them, then pick one per category.</p>}
            <p className="fine">We use the best price we have: accepted quote first, then latest quote, your number, or their listed price.</p>
          </section>
        </div>
      </div>
      {priced.length > 0 && (
        <div>
          <TradeOffs rows={priced.map((r) => ({ name: r.name, kind: r.kind, vendor: r.vendor, source: r.source, fixedCents: r.fixedCents, perPersonPick: r.perPersonPick, lowCents: r.lowCents, highCents: r.highCents, perGuest: r.perGuest, optional: r.optional }))} budgetCents={event.budget_cents} guestCount={event.guest_count} />
        </div>
      )}
    </div>
  );
}
