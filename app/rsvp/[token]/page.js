import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE, formatDate } from '@/lib/format';
import ActionForm from '@/components/forms/ActionForm';
import { respondRsvp, claimGift } from '../actions';

export const metadata = { title: 'RSVP', robots: { index: false } };

export default async function RsvpPage({ params }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const [{ data }, { data: gifts }] = await Promise.all([
    supabase.rpc('rsvp_lookup', { t: token }),
    supabase.rpc('registry_for_guest', { t: token }),
  ]);
  const g = data?.[0];
  if (!g) {
    return (
      <div className="page wrap measure stack">
        <h1 className="display-2">This RSVP link is not active</h1>
        <p className="muted">The host may have turned off replies. Contact them directly.</p>
      </div>
    );
  }
  const when = [formatDate(g.event_date), g.location].filter(Boolean).join(', ');
  const options = Array.from({ length: g.party_size }, (_, i) => i + 1);
  return (
    <div className="page wrap rsvp-page">
      <header className="page-head">
        <p className="label">You’re invited</p>
        <h1 className="display-2">{g.event_title}</h1>
        {when && <p className="lede">{when}</p>}
      </header>
      <section className="panel stack measure" aria-labelledby="rsvp-h">
        <h2 id="rsvp-h" className="title">Hi {g.guest_name}, can you come?</h2>
        {g.status !== 'invited' && <p className="notice">Your current reply: <b>{g.status === 'yes' ? 'Coming' : g.status === 'no' ? 'Not coming' : 'Maybe'}</b>{g.attending ? `, ${g.attending} attending` : ''}{g.meal ? `, ${g.meal}` : ''}. You can change it below.</p>}
        <ActionForm action={respondRsvp}>
          <input type="hidden" name="token" value={token} />
          <fieldset className="stack-sm">
            <legend className="label">Your reply</legend>
            {[['yes', 'Yes, I’ll be there'], ['maybe', 'Maybe'], ['no', 'Sorry, I can’t come']].map(([v, l]) => (
              <label key={v} className="check-row"><input type="radio" name="status" value={v} required defaultChecked={g.status === v} /><span>{l}</span></label>
            ))}
          </fieldset>
          {g.party_size > 1 && (
            <div className="field"><label htmlFor="attending">How many of your party ({g.party_size} invited) are coming?</label>
              <select id="attending" name="attending" defaultValue={String(g.attending || g.party_size)}>{options.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          )}
          {g.party_size === 1 && <input type="hidden" name="attending" value="1" />}
          {g.meal_options?.length > 0 && (
            <div className="field"><label htmlFor="meal">Meal choice</label>
              <select id="meal" name="meal" defaultValue={g.meal ?? ''}><option value="">Choose later</option>{g.meal_options.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          )}
          <div className="field"><label htmlFor="dietary">Allergies or dietary needs (optional)</label>
            <input id="dietary" name="dietary" defaultValue={g.dietary ?? ''} maxLength={300} /></div>
          <div className="row"><button className="btn" type="submit">Send reply</button></div>
        </ActionForm>
        <p className="fine">Your reply goes only to the host of this {g.event_type.toLowerCase()}. No account needed.</p>
      </section>
      {gifts?.length > 0 && (
        <section className="panel stack measure" aria-labelledby="reg-h" style={{ marginTop: 'var(--s-6)' }}>
          <h2 id="reg-h" className="title">Registry</h2>
          <p className="small muted">Claim a gift so nobody else buys the same one, then buy it from the store yourself. Vendora does not sell or ship anything.</p>
          <ul role="list" className="booking-list">
            {gifts.map((it) => (
              <li key={it.item_id}>
                <div className="stack-sm" style={{ flex: '1 1 240px' }}>
                  <p className="title">{it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer nofollow">{it.title}<span className="sr-only"> (opens in a new tab)</span></a> : it.title}</p>
                  <p className="fine">{[it.price_note, it.note, it.mine ? `You claimed ${it.mine}` : null, `${it.remaining} of ${it.quantity} still open`].filter(Boolean).join('. ')}</p>
                </div>
                {it.mine ? (
                  <ActionForm action={claimGift} className="row">
                    <input type="hidden" name="token" value={token} /><input type="hidden" name="item_id" value={it.item_id} /><input type="hidden" name="quantity" value="0" />
                    <span className="badge badge-ok">Yours</span><button className="btn btn-sm btn-outline" type="submit">Release</button>
                  </ActionForm>
                ) : it.remaining > 0 ? (
                  <ActionForm action={claimGift} className="row">
                    <input type="hidden" name="token" value={token} /><input type="hidden" name="item_id" value={it.item_id} /><input type="hidden" name="quantity" value="1" />
                    <button className="btn btn-sm" type="submit">I’ll get this</button>
                  </ActionForm>
                ) : <span className="badge badge-plain">Claimed</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
