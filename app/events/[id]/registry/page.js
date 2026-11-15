import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { setRegistry, addRegistryItem, removeRegistryItem } from '@/app/actions/planning';

export const metadata = { title: 'Registry' };

export default async function RegistryPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/registry`);

  const [{ data: event }, { data: items }, { data: claims }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, registry_enabled, guest_list_enabled').eq('id', id).maybeSingle(),
    supabase.from('event_registry_items').select('*').eq('event_id', id).order('created_at'),
    supabase.from('registry_claims').select('item_id, quantity, event_guests(name)'),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const hidden = <input type="hidden" name="event_id" value={event.id} />;
  const byItem = {};
  for (const c of claims ?? []) (byItem[c.item_id] ??= []).push(c);
  const list = items ?? [];

  return (
    <div className="page wrap ev">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Registry" size="display-2"
        lede="Optional. List gifts with links to any store. Guests claim them from their RSVP page so nobody doubles up." />

      {!event.registry_enabled ? (
        <section className="panel stack measure">
          <p className="small">Vendora only keeps the list and who claimed what. Guests buy from the store you link; nothing is bought or paid here.</p>
          {isOwner ? (
            <ActionForm action={setRegistry}>{hidden}<input type="hidden" name="enabled" value="yes" />
              <div className="row"><button className="btn" type="submit">Turn on registry</button></div>
            </ActionForm>
          ) : <p className="notice">Only the event owner can turn on the registry.</p>}
        </section>
      ) : (
        <div className="event-layout">
          <div className="stack-lg">
            {!event.guest_list_enabled && (
              <p className="notice notice-warn">Guests see the registry on their RSVP page. <Link href={`/events/${event.id}/guests`}>Turn on the guest list</Link> to give them a link.</p>
            )}
            <section className="panel stack" aria-labelledby="gifts-h">
              <div className="panel-head"><h2 id="gifts-h">Gifts ({list.length})</h2></div>
              {list.length ? (
                <ul role="list" className="booking-list">
                  {list.map((it) => {
                    const cl = byItem[it.id] ?? [];
                    const taken = cl.reduce((n, c) => n + c.quantity, 0);
                    return (
                      <li key={it.id}>
                        <div className="stack-sm ev-grow">
                          <p className="title">{it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer nofollow">{it.title}<span className="sr-only"> (opens in a new tab)</span></a> : it.title}</p>
                          <p className="fine">{[it.price_note, it.quantity > 1 ? `${it.quantity} wanted` : null, it.note].filter(Boolean).join('. ')}</p>
                          {cl.length > 0 && <p className="fine">Claimed by {cl.map((c) => `${c.event_guests?.name ?? 'a guest'}${c.quantity > 1 ? ` (${c.quantity})` : ''}`).join(', ')}</p>}
                        </div>
                        <div className="row">
                          <span className={`badge ${taken >= it.quantity ? 'badge-ok' : 'badge-plain'} num`}>{taken >= it.quantity ? 'All claimed' : `${taken} of ${it.quantity} claimed`}</span>
                          {isOwner && <form action={removeRegistryItem}>{hidden}<input type="hidden" name="id" value={it.id} /><button className="btn btn-sm btn-outline" type="submit">Remove</button></form>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <div className="empty"><h3>No gifts yet</h3><p className="muted small">Add the first one on the right.</p></div>}
            </section>
          </div>
          {isOwner && (
            <aside className="stack-lg">
              <section className="panel stack" aria-labelledby="add-r">
                <h2 id="add-r" className="title">Add a gift</h2>
                <ActionForm action={addRegistryItem} resetOnOk>
                  {hidden}
                  <div className="field"><label htmlFor="r-title">Gift</label><input id="r-title" name="title" required maxLength={160} /></div>
                  <div className="field"><label htmlFor="r-url">Store link (optional)</label><input id="r-url" name="url" type="url" placeholder="https://" maxLength={2000} /></div>
                  <div className="field"><label htmlFor="r-price">Price as listed (optional)</label><input id="r-price" name="price_note" maxLength={40} placeholder="About $45" /></div>
                  <div className="field"><label htmlFor="r-qty">How many</label><input id="r-qty" name="quantity" inputMode="numeric" defaultValue="1" /></div>
                  <div className="field"><label htmlFor="r-note">Note (optional)</label><input id="r-note" name="note" maxLength={300} placeholder="Color, size" /></div>
                  <button className="btn" type="submit">Add gift</button>
                </ActionForm>
              </section>
              <ActionForm action={setRegistry}>{hidden}<input type="hidden" name="enabled" value="no" />
                <button className="btn btn-sm btn-outline" type="submit">Turn off registry</button>
              </ActionForm>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
