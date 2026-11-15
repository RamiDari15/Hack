import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { VENDOR_STATUS, formatDate } from '@/lib/format';
import { reviewVendor } from '@/app/actions/marketplace';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';

export const metadata = { title: 'Vendor review' };

export default async function AdminPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/admin');
  const { data: me } = await supabase.from('profiles').select('roles').eq('id', user.id).maybeSingle();
  if (!me?.roles?.includes('admin')) notFound();

  const show = ['pending', 'verified', 'rejected'].includes(sp?.show) ? sp.show : 'pending';
  const { data: vendors } = await supabase.from('vendors')
    .select('id, name, category, city, service_radius_mi, description, legal_name, business_id, website, contact_email, phone, verification_status, review_note, submitted_at, created_at')
    .eq('verification_status', show).order('created_at');
  const list = vendors ?? [];

  return (
    <div className="page wrap">
      <PageHead title="Vendor review." lede="Check each business against its website and registration before verifying. Verified vendors appear in search and can receive inquiries." />
      <nav className="chips" aria-label="Filter by status">
        {Object.entries(VENDOR_STATUS).map(([k, s]) => <a key={k} className="chip" href={`/admin?show=${k}`} aria-current={k === show ? 'page' : undefined}>{s.label}</a>)}
      </nav>
      {list.length === 0 && <div className="empty"><h2>Nothing here</h2><p className="muted small">No vendors with this status.</p></div>}
      <ul role="list" className="stack-lg">
        {list.map((v) => (
          <li key={v.id} className="panel stack">
            <div className="panel-head">
              <div className="stack-sm"><h2>{v.name}</h2><p className="fine">{v.category}{v.city ? `, ${v.city}` : ''}{v.service_radius_mi != null ? `, travels ${v.service_radius_mi} mi` : ''}. Applied {formatDate(v.submitted_at ?? v.created_at)}.</p></div>
              <span className={`badge ${VENDOR_STATUS[v.verification_status].tone}`}>{VENDOR_STATUS[v.verification_status].label}</span>
            </div>
            {v.description && <p className="small measure">{v.description}</p>}
            <dl className="kv">
              <div><dt>Legal name</dt><dd>{v.legal_name || 'Not given'}</dd></div>
              <div><dt>Registration</dt><dd>{v.business_id || 'Not given'}</dd></div>
              <div><dt>Website</dt><dd>{v.website ? <a href={v.website} target="_blank" rel="noopener noreferrer nofollow">{v.website}<span className="sr-only"> (opens in a new tab)</span></a> : 'Not given'}</dd></div>
              <div><dt>Contact</dt><dd>{[v.contact_email, v.phone].filter(Boolean).join(', ') || 'Not given'}</dd></div>
            </dl>
            {v.review_note && <p className="fine">Last note: {v.review_note}</p>}
            <div className="review-actions">
              <ActionForm action={reviewVendor}>
                <input type="hidden" name="id" value={v.id} /><input type="hidden" name="decision" value="verified" />
                <button className="btn" type="submit">Verify</button>
              </ActionForm>
              <ActionForm action={reviewVendor}>
                <input type="hidden" name="id" value={v.id} /><input type="hidden" name="decision" value="rejected" />
                <div className="field"><label htmlFor={`note-${v.id}`}>Or ask for changes</label><textarea id={`note-${v.id}`} name="note" maxLength={1000} placeholder="What the vendor needs to fix" /></div>
                <button className="btn btn-outline" type="submit">Ask for changes</button>
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
