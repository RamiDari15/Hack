/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, moneyCents } from '@/lib/format';
import { loadShortlist } from '@/lib/shortlist';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { removeFromShortlist, setPackagePick, voteOnVendor, addShortlistComment, deleteShortlistComment } from '@/app/actions/shared';

export const metadata = { title: 'Shortlist' };

export default async function ShortlistPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/shortlist`);
  const { data: event } = await supabase.from('events').select('id, owner_id, title, location, guest_count').eq('id', id).maybeSingle();
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const { items } = await loadShortlist(supabase, id, event);
  const groups = {};
  for (const it of items) (groups[it.category] ??= []).push(it);
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Shortlist" size="display-2"
        lede="Save 3 or 4 businesses per category, vote and comment together, then compare them side by side.">
        <Link className="btn btn-sm btn-outline" href={`/events/${event.id}/choose`}>Add from the vendor walkthrough</Link>
        <Link className="btn btn-sm" href={`/events/${event.id}/package`}>See the package total</Link>
      </PageHead>
      {sp?.compare === 'few' && <p className="notice notice-error" role="alert">Pick 2 to 4 vendors to compare.</p>}

      {items.length ? (
        <form method="get" action={`/events/${event.id}/compare`} id="compare-form" className="compare-bar panel">
          <p className="small">Tick 2 to 4 vendors, then compare price, services, distance, photos and policies.</p>
          <button className="btn btn-sm" type="submit">Compare selected</button>
        </form>
      ) : (
        <div className="panel empty"><h3>Nothing shortlisted yet</h3><p className="muted small">Use “Add to shortlist” in the vendor walkthrough or on any vendor’s page.</p>
          <Link className="btn btn-sm" href={`/events/${event.id}/choose`}>Choose vendors</Link></div>
      )}

      {Object.entries(groups).map(([cat, list]) => (
        <section key={cat} className="stack" aria-labelledby={`sl-${cat}`} style={{ marginTop: 'var(--s-7, 3rem)' }}>
          <h2 id={`sl-${cat}`} className="display-3">{cat} <span className="fine">{list.length} saved</span></h2>
          <div className="match-grid">
            {list.map((it) => {
              const mine = it.voters.find((x) => x.userId === user.id)?.vote ?? 0;
              return (
                <article key={it.id} className={`panel stack shortlist-card${it.inPackage ? ' is-best' : ''}`} aria-labelledby={`sv-${it.id}`}>
                  {it.photo && <img className="shortlist-photo" src={it.photo} alt={`${it.name} portfolio`} loading="lazy" />}
                  <div className="row">
                    {it.inPackage && <span className="badge badge-accent">In package</span>}
                    <span className={`badge ${it.verified ? 'badge-ok' : 'badge-plain'}`}>{it.verified ? 'Verified' : 'Public listing'}</span>
                    {it.booking && <span className="badge badge-info">Contacted</span>}
                  </div>
                  <h3 id={`sv-${it.id}`} className="title"><Link href={`/vendors/${it.vendorId}`}>{it.name}</Link></h3>
                  <p className="fine">{[it.city, it.distanceMi != null ? `${it.distanceMi} mi from Ann Arbor` : null, it.lowest ? `published from ${moneyCents(it.lowest.cents)}${it.lowest.unit !== 'event' ? `/${it.lowest.unit}` : ''}` : 'no published price', it.quote ? `quote ${moneyCents(it.quote.amount_cents)}` : null].filter(Boolean).join(' · ')}</p>
                  <p className="fine">Added by {it.addedBy}</p>
                  <label className="check-row small"><input type="checkbox" name="ids" value={it.id} form="compare-form" /><span>Compare</span></label>

                  <div className="row votes" aria-label="Votes">
                    <form action={voteOnVendor}>{hidden}<input type="hidden" name="shortlist_id" value={it.id} /><input type="hidden" name="vote" value={mine === 1 ? 0 : 1} />
                      <button className={`btn btn-sm ${mine === 1 ? '' : 'btn-outline'}`} type="submit" aria-pressed={mine === 1}>Yes {it.up}</button></form>
                    <form action={voteOnVendor}>{hidden}<input type="hidden" name="shortlist_id" value={it.id} /><input type="hidden" name="vote" value={mine === -1 ? 0 : -1} />
                      <button className={`btn btn-sm ${mine === -1 ? '' : 'btn-outline'}`} type="submit" aria-pressed={mine === -1}>No {it.down}</button></form>
                    {it.voters.length > 0 && <span className="fine">{it.voters.map((v) => `${v.name} ${v.vote > 0 ? 'yes' : 'no'}`).join(', ')}</span>}
                  </div>

                  <div className="stack-sm comments">
                    {it.comments.map((c) => (
                      <div key={c.id} className="comment small"><b>{c.author}</b> {c.body}
                        {c.user_id === user.id && <form action={deleteShortlistComment} className="inline-form">{hidden}<input type="hidden" name="id" value={c.id} /><button type="submit" className="as-link fine">Delete</button></form>}</div>
                    ))}
                    <ActionForm action={addShortlistComment} resetOnOk className="row comment-form">
                      {hidden}<input type="hidden" name="shortlist_id" value={it.id} />
                      <label className="sr-only" htmlFor={`cm-${it.id}`}>Comment on {it.name}</label>
                      <input id={`cm-${it.id}`} name="body" maxLength={1000} placeholder="Add a comment" />
                      <button className="btn btn-sm btn-outline" type="submit">Post</button>
                    </ActionForm>
                  </div>

                  <div className="row">
                    {isOwner && (
                      <ActionForm action={setPackagePick} className="row">
                        {hidden}<input type="hidden" name="id" value={it.id} /><input type="hidden" name="in_package" value={it.inPackage ? 'no' : 'yes'} />
                        <button className={`btn btn-sm ${it.inPackage ? 'btn-outline' : ''}`} type="submit">{it.inPackage ? 'Remove from package' : 'Pick for package'}</button>
                      </ActionForm>
                    )}
                    {(isOwner || it.addedById === user.id) && <form action={removeFromShortlist}>{hidden}<input type="hidden" name="id" value={it.id} /><button className="btn btn-sm btn-outline" type="submit">Remove</button></form>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
