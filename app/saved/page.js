import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import { toggleSavedVendor } from '@/app/actions/inbox';

export const metadata = { title: 'Saved vendors' };

export default async function SavedPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/saved');
  const { data } = await supabase.from('saved_vendors').select('created_at, vendors(id, name, category, city, verification_status, portfolio_photos)').order('created_at', { ascending: false });
  const list = (data ?? []).filter((r) => r.vendors);
  return (
    <div className="page wrap">
      <PageHead title="Saved vendors" size="display-2" lede="Businesses you saved while browsing. Add them to an event’s shortlist to compare and vote." />
      {list.length ? (
        <ul role="list" className="saved-grid">
          {list.map(({ vendors: v }) => (
            <li key={v.id} className="panel stack-sm">
              <div className="between"><span className="fine">{v.category}</span><span className={`badge ${v.verification_status === 'verified' ? 'badge-ok' : 'badge-plain'}`}>{v.verification_status === 'verified' ? 'Verified' : 'Public listing'}</span></div>
              <Link className="title" href={`/vendors/${v.id}`}>{v.name}</Link>
              <p className="fine">{v.city}</p>
              <form action={toggleSavedVendor}><input type="hidden" name="vendor_id" value={v.id} /><input type="hidden" name="save" value="no" /><button className="as-link fine" type="submit">Remove</button></form>
            </li>
          ))}
        </ul>
      ) : <div className="panel empty"><h3>Nothing saved yet</h3><p className="muted small">Tap Save on any vendor’s page.</p><Link className="btn btn-sm" href="/vendors">Browse vendors</Link></div>}
    </div>
  );
}
