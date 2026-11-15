import { getSessionUser } from '@/lib/supabase/server';
import DiscoverSearch from './DiscoverSearch';
import { listVendors } from '@/lib/vendors';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Web search' };

export default async function DiscoverPage({ searchParams }) {
  const sp = await searchParams;
  const initialQuery = typeof sp?.q === 'string' ? sp.q.slice(0, 300) : '';
  const { user, supabase } = await getSessionUser();
  const { vendors, mode } = await listVendors({ verifiedOnly: true });
  let events = [];
  if (supabase && user) {
    const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false }).limit(30);
    events = data ?? [];
  }
  return (
    <div className="page wrap">
      <PageHead title="Search past our listings." lede="Find venues, vendors and ideas from across the web." />
      <DiscoverSearch signedIn={Boolean(user)} configured={Boolean(supabase)} verified={vendors.slice(0, 3).map((v) => ({ id: v.id, name: v.name, category: v.category, city: v.city, sample: v.sample }))} verifiedMode={mode} events={events} initialQuery={initialQuery} />
    </div>
  );
}
