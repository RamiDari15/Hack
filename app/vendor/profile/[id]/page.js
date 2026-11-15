import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE, VENDOR_STATUS, moneyCents, vendorFormValues } from '@/lib/format';
import { updateVendor, addPackage, removePackage } from '@/app/actions/marketplace';
import PageHead from '@/components/PageHead';
import VendorForm from '@/components/forms/VendorForm';
import ActionForm from '@/components/forms/ActionForm';

export const metadata = { title: 'Edit vendor profile' };

export default async function VendorProfileEdit({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect(`/sign-in?next=/vendor/profile/${id}`);

  const { data: v } = await supabase.from('vendors').select('*, vendor_packages(id, title, price_cents, description, created_at)').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (!v) notFound();
  const s = VENDOR_STATUS[v.verification_status] ?? VENDOR_STATUS.pending;
  const pkgs = [...(v.vendor_packages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="page wrap">
      <PageHead back={{ href: '/vendor', label: 'Vendor dashboard' }} title={v.name} lede={`${v.category}${v.city ? `, ${v.city}` : ''}`}>
        <span className={`badge ${s.tone}`}>{s.label}</span>
        {v.verification_status === 'verified' && <Link className="btn btn-sm btn-outline" href={`/vendors/${v.id}`}>View public page</Link>}
      </PageHead>
      {sp?.submitted && <p className="notice notice-ok" role="status">Application sent. We will review it and you will see the result here.</p>}
      {v.verification_status === 'pending' && !sp?.submitted && <p className="notice">In review. Your profile is hidden from customers until it is verified.</p>}
      {v.verification_status === 'rejected' && <p className="notice notice-warn">The reviewer asked for changes{v.review_note ? `: ${v.review_note}` : '.'} Saving your edits sends the profile back for review.</p>}

      <div className="event-layout">
        <section className="panel stack" aria-labelledby="details-h">
          <h2 id="details-h">Details</h2>
          <VendorForm action={updateVendor} vendorId={v.id} initial={vendorFormValues(v)} />
        </section>

        <section className="panel stack" aria-labelledby="pkg-h">
          <h2 id="pkg-h">Packages</h2>
          <p className="fine">Leave the price empty if you quote per event. Customers see it as “Quote required”.</p>
          {pkgs.length ? (
            <ul role="list" className="booking-list">
              {pkgs.map((p) => (
                <li key={p.id}>
                  <div className="stack-sm"><span className="title">{p.title}</span>{p.description && <span className="fine">{p.description}</span>}</div>
                  <div className="row">
                    <span className="badge badge-accent num">{p.price_cents == null ? 'Quote required' : moneyCents(p.price_cents)}</span>
                    <form action={removePackage}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="vendor_id" value={v.id} /><button className="btn btn-sm btn-outline" type="submit">Remove</button></form>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No packages yet.</p>}
          <ActionForm action={addPackage} resetOnOk>
            <input type="hidden" name="vendor_id" value={v.id} />
            <div className="field"><label htmlFor="pkg-title">Package name</label><input id="pkg-title" name="title" maxLength={120} placeholder="Evening reception" required /></div>
            <div className="field"><label htmlFor="pkg-price">Price (USD)</label><input id="pkg-price" name="price" inputMode="decimal" placeholder="Leave empty to quote" /></div>
            <div className="field"><label htmlFor="pkg-desc">What is included</label><textarea id="pkg-desc" name="description" maxLength={500} /></div>
            <button className="btn btn-outline" type="submit">Add package</button>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
