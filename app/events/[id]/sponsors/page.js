import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, formatDate } from '@/lib/format';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import { saveSponsorLead, updateSponsorLead, deleteSponsorLead } from '@/app/actions/marketplace';

export const metadata = { title: 'Contact sponsors' };

const STATUS = {
  idea: { label: 'Idea', tone: 'badge-plain' },
  approved: { label: 'Ready to contact', tone: 'badge-plain' },
  contacted: { label: 'Contacted', tone: 'badge-warn' },
  agreed: { label: 'Agreed', tone: 'badge-ok' },
  declined: { label: 'Declined', tone: 'badge-plain' },
};

function draftProposal(event, lead) {
  const when = event.event_date ? ` on ${formatDate(event.event_date)}` : '';
  const where = event.location ? ` in ${event.location}` : '';
  const crowd = event.guest_count ? `about ${event.guest_count} guests` : 'our guests';
  return [
    `Hi ${lead.name} team,`,
    '',
    `I'm organizing ${event.title}, a ${event.event_type.toLowerCase()}${where}${when}, with ${crowd}.`,
    lead.reason ? `We think you'd be a good fit because ${lead.reason.replace(/\.$/, '')}.` : 'We think your business would be a good fit for our crowd.',
    '',
    'Would you be open to sponsoring? In return we can offer [your offer: a mention, signage, a table, samples].',
    '',
    'Happy to share more details. Thank you for considering it.',
  ].join('\n');
}

export default async function SponsorsPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/events/${id}/sponsors`);

  const [{ data: event }, { data: leads }] = await Promise.all([
    supabase.from('events').select('id, owner_id, title, event_type, event_date, location, guest_count').eq('id', id).maybeSingle(),
    supabase.from('sponsor_leads').select('*').eq('event_id', id).order('created_at'),
  ]);
  if (!event) notFound();
  const isOwner = event.owner_id === user.id;
  const list = leads ?? [];
  const city = (event.location ?? '').split(',')[0].trim();
  const ideaQuery = `local businesses that sponsor ${event.event_type.toLowerCase()} events${city ? ` in ${city}` : ''}`;

  return (
    <div className="page wrap">
      <PageHead back={{ href: `/events/${event.id}`, label: event.title }} title="Contact sponsors" size="display-2"
        lede="Make a short list of businesses that fit your crowd, draft a proposal, then email them from your own inbox.">
        <Link className="btn btn-sm btn-outline" href={`/ideas?q=${encodeURIComponent(ideaQuery)}`}>Find sponsor ideas on the web</Link>
      </PageHead>
      <p className="notice">Vendora never contacts sponsors for you. The Email button opens your own email app with the draft, and you decide whether to send it.</p>

      <div className="event-layout">
        <div className="stack-lg">
          {list.length ? list.map((lead) => {
            const s = STATUS[lead.status] ?? STATUS.idea;
            const proposal = lead.proposal ?? draftProposal(event, lead);
            const mailto = lead.contact_email
              ? `mailto:${lead.contact_email}?subject=${encodeURIComponent(`Sponsoring ${event.title}`)}&body=${encodeURIComponent(proposal)}`
              : null;
            return (
              <article className="panel stack" key={lead.id} aria-labelledby={`lead-${lead.id}`}>
                <div className="panel-head">
                  <h2 id={`lead-${lead.id}`} className="title">{lead.name}</h2>
                  <span className={`badge ${s.tone}`}>{s.label}</span>
                </div>
                <div className="row small">
                  {lead.url && <a href={lead.url} target="_blank" rel="noopener noreferrer nofollow">Website<span className="sr-only"> (opens in a new tab)</span></a>}
                  {lead.contact_email ? <span className="muted">{lead.contact_email}</span> : <span className="muted">No contact email yet</span>}
                </div>
                {lead.reason && <p className="small muted">Why they fit: {lead.reason}</p>}
                {isOwner ? (
                  <>
                    <ActionForm action={updateSponsorLead}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="event_id" value={event.id} />
                      <div className="field">
                        <label htmlFor={`proposal-${lead.id}`}>Proposal{lead.proposal ? '' : ' (drafted from your event details, edit before sending)'}</label>
                        <textarea id={`proposal-${lead.id}`} name="proposal" rows={9} defaultValue={proposal} maxLength={6000} />
                      </div>
                      <div className="row"><button className="btn btn-sm btn-outline" type="submit">Save proposal</button></div>
                    </ActionForm>
                    <div className="row">
                      {mailto
                        ? <a className="btn btn-sm" href={mailto}>Email {lead.name}</a>
                        : <span className="fine">Add a contact email to email them from here.</span>}
                      {lead.status !== 'contacted' && lead.status !== 'agreed' && (
                        <ActionForm action={updateSponsorLead} className="row">
                          <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="event_id" value={event.id} />
                          <input type="hidden" name="status" value="contacted" />
                          <button className="btn btn-sm btn-outline" type="submit">Mark as contacted</button>
                        </ActionForm>
                      )}
                      {lead.status === 'contacted' && (
                        <>
                          <ActionForm action={updateSponsorLead} className="row">
                            <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="event_id" value={event.id} />
                            <input type="hidden" name="status" value="agreed" />
                            <button className="btn btn-sm btn-outline" type="submit">They agreed</button>
                          </ActionForm>
                          <ActionForm action={updateSponsorLead} className="row">
                            <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="event_id" value={event.id} />
                            <input type="hidden" name="status" value="declined" />
                            <button className="btn btn-sm btn-outline" type="submit">They declined</button>
                          </ActionForm>
                        </>
                      )}
                      <form action={deleteSponsorLead}>
                        <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="event_id" value={event.id} />
                        <button className="btn btn-sm btn-outline" type="submit">Remove</button>
                      </form>
                    </div>
                  </>
                ) : (
                  lead.proposal && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{lead.proposal}</p>
                )}
              </article>
            );
          }) : (
            <div className="panel empty"><h3>No sponsors on your list yet</h3><p className="muted small">Add a business you already know, or search the web for ideas and add the ones that fit.</p></div>
          )}
        </div>

        <aside className="stack-lg">
          {isOwner ? (
            <section className="panel stack" aria-labelledby="add-h">
              <h2 id="add-h" className="title">Add a sponsor</h2>
              <ActionForm action={saveSponsorLead} resetOnOk>
                <input type="hidden" name="event_id" value={event.id} />
                <div className="field"><label htmlFor="sp-name">Business name</label><input id="sp-name" name="name" required maxLength={200} /></div>
                <div className="field"><label htmlFor="sp-url">Website (optional)</label><input id="sp-url" name="url" type="url" placeholder="https://" maxLength={2000} /></div>
                <div className="field"><label htmlFor="sp-contact_email">Contact email (optional)</label><input id="sp-contact_email" name="contact_email" type="email" maxLength={200} /></div>
                <div className="field"><label htmlFor="sp-reason">Why they fit (optional)</label><textarea id="sp-reason" name="reason" rows={3} maxLength={1000} /></div>
                <button className="btn" type="submit">Add to list</button>
              </ActionForm>
              <p className="fine">Only add contact details the business publishes or gave you.</p>
            </section>
          ) : (
            <p className="notice">Only the event owner can add or contact sponsors.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
