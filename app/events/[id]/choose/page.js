import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, BOOKING_STATUS, formatDate, moneyCents } from '@/lib/format';
import { walkthroughSteps, loadCandidates, rankVendors } from '@/lib/vendor-match';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { requestQuote } from '@/app/events/actions';
import AskAdvice from './AskAdvice';
import ShortlistButton from '@/components/ShortlistButton';

export const metadata = { title: 'Choose vendors' };

const TONE = { ok: 'reason-ok', warn: 'reason-warn', bad: 'reason-bad', plain: 'reason-plain' };

export default async function ChooseVendorsPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/choose`);

  const [{ data: event }, { data: plans }, { data: bookings }, { data: shortlisted }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, event_type, event_date, location, guest_count, budget_cents').eq('id', id).maybeSingle(),
    supabase.from('ai_requests').select('output').eq('event_id', id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1),
    supabase.from('event_vendors').select('id, status, vendor_id, vendors(category)').eq('event_id', id),
    supabase.from('event_shortlist').select('vendor_id').eq('event_id', id),
  ]);
  if (!event) notFound();
  const plan = plans?.[0]?.output ?? null;
  const steps = walkthroughSteps(event, plan);
  const isOwner = event.owner_id === user.id;
  const byCategory = {};
  for (const b of bookings ?? []) if (b.status !== 'cancelled') (byCategory[b.vendors?.category] ??= []).push(b);
  const onShortlist = new Set((shortlisted ?? []).map((r) => r.vendor_id));
  const bookingFor = Object.fromEntries((bookings ?? []).map((b) => [b.vendor_id, b]));

  const firstOpen = steps.findIndex((s) => !byCategory[s.category]);
  const asked = steps.findIndex((s) => s.category === sp?.step);
  // Always keep the step in the URL, so sending a quote request re-renders the same step.
  if (asked < 0) redirect(`/events/${event.id}/choose?step=${encodeURIComponent(steps[Math.max(firstOpen, 0)].category)}`);
  const index = asked;
  const step = steps[index];
  const { vendors, calendars } = await loadCandidates(supabase, event, step.category);
  const ranked = rankVendors({ vendors, calendars, event, step });
  const top = ranked.slice(0, 3);
  const more = ranked.slice(3, 9);
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const href = (s) => `/events/${event.id}/choose?step=${encodeURIComponent(s.category)}`;
  const meta = [formatDate(event.event_date), event.location, event.guest_count ? `${event.guest_count} guests` : null].filter(Boolean).join(', ');

  const card = (v, i, featured) => {
    const b = bookingFor[v.id];
    const s = b ? BOOKING_STATUS[b.status] ?? BOOKING_STATUS.inquiry : null;
    return (
      <article key={v.id} className={`panel stack match-card${featured && i === 0 ? ' is-best' : ''}`} aria-labelledby={`m-${v.id}`}>
        <div className="row">
          {featured && i === 0 && <span className="badge badge-accent">Best fit for this event</span>}
          {s ? <span className={`badge ${s.tone}`}>{s.label}</span> : <span className={`badge ${v.verified ? 'badge-ok' : 'badge-plain'}`}>{v.verified ? 'Verified' : 'Public listing'}</span>}
        </div>
        <h3 id={`m-${v.id}`} className="title"><Link href={`/vendors/${v.id}`}>{v.name}</Link></h3>
        <ul role="list" className="reasons">
          {v.reasons.map((r) => <li key={r.text} className={TONE[r.tone]}>{r.text}</li>)}
        </ul>
        <div className="row">
          {b ? <Link className="btn btn-sm btn-outline" href={`/bookings/${b.id}`}>Open conversation</Link>
            : v.verified && isOwner ? (
              <ActionForm action={requestQuote} className="stack-sm">
                <input type="hidden" name="vendor_id" value={v.id} />
                <input type="hidden" name="event_id" value={event.id} />
                <label className="check-row small"><input type="checkbox" name="confirm" value="yes" required /><span>Send {v.name} this event’s date, location and guest count. Nothing is booked or paid.</span></label>
                <div className="row"><button className="btn btn-sm" type="submit">Request a quote</button></div>
              </ActionForm>
            ) : v.website ? <a className="btn btn-sm btn-outline" href={v.website} target="_blank" rel="noopener noreferrer nofollow">Visit website<span className="sr-only"> (opens in a new tab)</span></a> : null}
          <Link className="btn btn-sm btn-outline" href={`/vendors/${v.id}`}>See profile</Link>
          {onShortlist.has(v.id) ? <Link className="badge badge-ok" href={`/events/${event.id}/shortlist`}>On shortlist</Link> : <ShortlistButton vendorId={v.id} eventId={event.id} />}
        </div>
      </article>
    );
  };

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Choose your vendors" size="display-2"
        lede={`One category at a time, ranked for ${meta || 'your event'}.`} />

      <nav aria-label="Vendor categories" className="choose-steps">
        <ol role="list">
          {steps.map((s, i) => {
            const done = Boolean(byCategory[s.category]);
            return (
              <li key={s.category}>
                <Link href={href(s)} aria-current={i === index ? 'step' : undefined} className={done ? 'is-done' : undefined}>
                  <span className="num" aria-hidden="true">{done ? '✓' : i + 1}</span> {s.category}
                  {done && <span className="sr-only"> (vendor contacted)</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="stack-lg" aria-labelledby="step-h">
        <div className="panel panel-quiet stack-sm">
          <p className="label">Step {index + 1} of {steps.length}</p>
          <h2 id="step-h" className="display-3">{step.category}</h2>
          {step.highCents != null
            ? <p className="small">Your AI ballpark for {step.category.toLowerCase()} is <b className="num">{moneyCents(step.lowCents)}–{moneyCents(step.highCents)}</b>{step.notes ? ` (${step.notes})` : ''}. Vendors are ranked against it.</p>
            : <p className="small">Build a plan first and vendors are ranked against your budget for each category. <Link href={`/planner?event=${event.id}`}>Build a plan</Link></p>}
          <p className="fine">Best matches first, by distance, price and availability.</p>
        </div>

        {byCategory[step.category] && <p className="notice notice-ok">You have already contacted a {step.category.toLowerCase()} vendor for this event. You can still compare others.</p>}

        {ranked.length ? (
          <>
            <AskAdvice key={step.category} eventId={event.id} category={step.category} names={Object.fromEntries(ranked.map((v) => [v.id, v.name]))} />
            <div className="match-grid">{top.map((v, i) => card(v, i, true))}</div>
            {more.length > 0 && (
              <details className="panel disclosure">
                <summary>More {step.category.toLowerCase()} options ({more.length})</summary>
                <div className="match-grid" style={{ marginTop: 'var(--s-5)' }}>{more.map((v, i) => card(v, i, false))}</div>
              </details>
            )}
          </>
        ) : (
          <div className="panel empty"><h3>No {step.category.toLowerCase()} vendors near this event yet</h3><p className="muted small">Try the web search, then confirm details with the business.</p>
            <Link className="btn btn-sm btn-outline" href={`/discover?q=${encodeURIComponent(`${step.category} near ${event.location ?? ''}`)}`}>Search the web</Link></div>
        )}

        <div className="between choose-nav">
          {prev ? <Link className="btn btn-outline" href={href(prev)}>Back: {prev.category}</Link> : <span />}
          {next ? <Link className="btn" href={href(next)}>Next: {next.category}</Link>
            : <Link className="btn" href={`/events/${event.id}`}>Finish and review your event</Link>}
        </div>
      </section>
    </div>
  );
}
