import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import VendorCard from '@/components/VendorCard';
import { normalizeVendor } from '@/lib/vendors';

export const metadata = { title: 'Saved vendors' };

export default async function SavedPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in?next=/saved');
  const [{data},{data:events}]=await Promise.all([supabase.from('saved_vendors').select('created_at, vendors(*,vendor_packages(title,price_cents,description))').order('created_at',{ascending:false}),supabase.from('events').select('id,title,guest_count').order('created_at',{ascending:false}).limit(30)]);
  const list = (data ?? []).filter((r) => r.vendors);
  return (
    <div className="page wrap">
      <PageHead title="Saved vendors" size="display-2" lede="Businesses you saved while browsing. Add them to an event’s shortlist to compare and vote."><Link className="btn btn-sm btn-outline" href="/ideas?saved=1">Saved ideas</Link><Link className="btn btn-sm" href="/vendors">Find more vendors</Link></PageHead>
      {list.length ? (
        <ul role="list" className="saved-grid">
          {list.map(({ vendors: v }) => (
            <li key={v.id}><VendorCard vendor={normalizeVendor(v)} signedIn saved events={events||[]} /></li>
          ))}
        </ul>
      ) : <div className="panel empty"><h3>Nothing saved yet</h3><p className="muted small">Tap Save on any vendor’s page.</p><Link className="btn btn-sm" href="/vendors">Browse vendors</Link></div>}
    </div>
  );
}
