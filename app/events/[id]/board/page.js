/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import { removeBoardItem } from '@/app/actions/shared';
import AddToBoard from './AddToBoard';

export const metadata = { title: 'Style board' };

const SECTIONS = [
  { key: 'venue', label: 'Venue' }, { key: 'flowers', label: 'Flowers' }, { key: 'decor', label: 'Decor' },
  { key: 'outfits', label: 'Outfits' }, { key: 'other', label: 'Other' },
];

export default async function BoardPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/board`);
  const section = SECTIONS.some((s) => s.key === sp?.section) ? sp.section : '';
  let q = supabase.from('style_board_items').select('id, section, image_url, caption, added_by, created_at').eq('event_id', id).order('created_at', { ascending: false });
  if (section) q = q.eq('section', section);
  const [{ data: event }, { data: items }, { data: people }, { data: counts }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title').eq('id', id).maybeSingle(),
    q,
    supabase.rpc('event_people', { e: id }),
    supabase.from('style_board_items').select('section').eq('event_id', id),
  ]);
  if (!event) notFound();
  const names = Object.fromEntries((people ?? []).map((p) => [p.user_id, p.display_name]));
  const count = (k) => (counts ?? []).filter((c) => c.section === k).length;
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Style board" size="display-2"
        lede="Collect the look: venue, flowers, decor and outfits. Share it with your team and show vendors what you mean." />
      <nav className="chips filter-chips" aria-label="Board sections" style={{ marginTop: 0 }}>
        <Link className="chip" href={`/events/${event.id}/board`} aria-current={!section ? 'page' : undefined}>All ({(counts ?? []).length})</Link>
        {SECTIONS.map((s) => <Link key={s.key} className="chip" href={`/events/${event.id}/board?section=${s.key}`} aria-current={section === s.key ? 'page' : undefined}>{s.label} ({count(s.key)})</Link>)}
      </nav>
      <div className="event-layout">
        <section aria-label="Inspiration photos">
          {items?.length ? (
            <ul role="list" className="board-grid">
              {items.map((it) => (
                <li key={it.id} className="board-item">
                  <img src={it.image_url ?? `/api/board-image/${it.id}`} alt={it.caption || `${SECTIONS.find((s) => s.key === it.section)?.label} inspiration`} loading="lazy" referrerPolicy="no-referrer" />
                  <div className="board-meta">
                    <p className="small">{it.caption}</p>
                    <p className="fine">{SECTIONS.find((s) => s.key === it.section)?.label} · {names[it.added_by] ?? 'Someone'}{it.image_url ? ' · linked' : ''}</p>
                    {(event.owner_id === user.id || it.added_by === user.id) && (
                      <form action={removeBoardItem}>{hidden}<input type="hidden" name="id" value={it.id} /><button className="as-link fine" type="submit">Remove</button></form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="panel empty"><h3>Nothing here yet</h3><p className="muted small">Upload a photo or paste an image link to start the board.</p></div>}
        </section>
        <aside className="stack-lg">
          <section className="panel stack" aria-labelledby="bd-h">
            <h2 id="bd-h" className="title">Add inspiration</h2>
            <AddToBoard eventId={event.id} section={section || 'venue'} sections={SECTIONS} />
          </section>
        </aside>
      </div>
    </div>
  );
}
