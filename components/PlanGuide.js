import Link from 'next/link';

// Step-by-step guide for planning one event. Each step is marked done from the event's real data,
// and the first unfinished step is highlighted as the next thing to do.
export default function PlanGuide({ event, plan, bookings, quotes, sponsors, timelineCount = 0, guestCount = 0, giftCount = 0, shortlistCount = 0 }) {
  const confirmed = bookings.find((b) => b.status === 'confirmed');
  const quoted = bookings.find((b) => (b.quotes ?? []).some((q) => q.status === 'sent'));
  const steps = [
    {
      key: 'details', title: 'Add the event details',
      text: 'Date, location, guest count and budget shape the plan and every vendor search.',
      done: Boolean(event.event_date && event.location && event.guest_count && event.budget_cents != null),
      cta: { href: `/events/${event.id}?edit=1#edit-details`, label: 'Edit details' },
    },
    {
      key: 'estimate', title: 'Build your plan',
      text: 'The AI planner splits your budget using verified vendors and local published prices.',
      done: Boolean(plan),
      cta: { href: `/planner?event=${event.id}`, label: plan ? 'Rebuild plan' : 'Build a plan' },
    },
    {
      key: 'vendors', title: 'Choose vendors',
      text: 'Walk through each category with vendors ranked for your budget, date and location.',
      done: bookings.length > 0 || shortlistCount > 0,
      cta: { href: `/events/${event.id}/choose`, label: 'Choose vendors' },
    },
    {
      key: 'quotes', title: 'Compare and accept quotes',
      text: 'Quotes replace AI ballparks as they arrive. Accept the ones that fit.',
      done: quotes.some((q) => q.status === 'accepted'),
      cta: { href: `/events/${event.id}/quotes`, label: quoted ? 'Compare quotes' : 'See quotes' },
    },
    {
      key: 'confirm', title: 'Confirm a booking',
      text: 'You confirm each booking yourself. Nothing is paid or sent without your confirmation.',
      done: Boolean(confirmed),
      cta: { href: confirmed ? `/bookings/${confirmed.id}` : '#vendors-h', label: confirmed ? 'Open booking' : 'See vendors' },
    },
    {
      key: 'timeline', title: 'Plan the day',
      text: 'Build a run sheet: when each vendor arrives, sets up and leaves. The AI can draft it from your bookings.',
      done: timelineCount > 0,
      cta: { href: `/events/${event.id}/timeline`, label: timelineCount ? 'Open timeline' : 'Build timeline' },
    },
    {
      key: 'sponsors', title: 'Contact sponsors',
      text: 'List local businesses that fit your crowd, draft a proposal and email them from your own inbox.',
      done: sponsors.some((s) => s.status === 'contacted' || s.status === 'agreed'),
      cta: { href: `/events/${event.id}/sponsors`, label: 'Contact sponsors' },
    },
  ];
  const next = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="panel stack plan-guide" aria-labelledby="guide-h">
      <div className="panel-head">
        <h2 id="guide-h">Plan step by step</h2>
        <span className="badge badge-plain num">{doneCount} of {steps.length} done</span>
      </div>
      <div className="guide-bar" aria-hidden="true"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      <ol role="list" className="guide-steps">
        {steps.map((s, i) => {
          const isNext = s === next;
          return (
            <li key={s.key} className={s.done ? 'is-done' : isNext ? 'is-next' : undefined} aria-current={isNext ? 'step' : undefined}>
              <span className="guide-dot num" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
              <div className="stack-sm guide-body">
                <h3 className="title">{s.title}<span className="sr-only">{s.done ? ' (done)' : isNext ? ' (next step)' : ''}</span></h3>
                {(isNext || !s.done) && <p className="small muted">{s.text}</p>}
              </div>
              <Link className={`btn btn-sm ${isNext ? '' : 'btn-outline'}`} href={s.cta.href}>{s.cta.label}</Link>
            </li>
          );
        })}
      </ol>
      <div className="guide-optional">
        <p className="label">Optional</p>
        <div className="row">
          <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/guests`}>{event.guest_list_enabled ? `Guest list (${guestCount})` : 'Add a guest list and RSVPs'}</Link>
          <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/registry`}>{event.registry_enabled ? `Registry (${giftCount})` : 'Add a registry'}</Link>
        </div>
      </div>
      {plan?.checklist?.length > 0 && (
        <div className="stack-sm guide-ai">
          <div className="between"><h3 className="label">Tasks the planner generated for this event</h3><span className="badge badge-warn">AI suggestion</span></div>
          <ol className="num-list">{plan.checklist.map((c, i) => <li key={i}><div><b>{c.task}</b><p className="fine">{c.when}</p></div></li>)}</ol>
          <p className="fine">Changed the details? Rebuild the AI plan to refresh these.</p>
        </div>
      )}
      {plan && !plan.checklist?.length && <p className="fine">Rebuild the AI plan to get to-dos for this event.</p>}
      {!plan && <p className="fine">Get an AI plan and your to-dos show up here.</p>}
      {!next && <p className="notice notice-ok">Every step is done. Keep an eye on vendor messages as the date gets closer.</p>}
    </section>
  );
}
