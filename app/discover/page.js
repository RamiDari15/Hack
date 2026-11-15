import { getSessionUser } from '@/lib/supabase/server';
import DiscoverSearch from './DiscoverSearch';
import { listVendors } from '@/lib/vendors';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'Web search' };

export default async function DiscoverPage() {
  const { user, supabase } = await getSessionUser();
  const { vendors, mode } = await listVendors({ verifiedOnly: true });
  let events = [];
  if (supabase && user) {
    const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false }).limit(30);
    events = data ?? [];
  }
  return (
    <div className="page wrap">
      <PageHead title="Search past our listings." lede="Look for venues, vendors and ideas across the web. Results come from an AI web search and sit apart from verified vendors, each with its source." />
      <DiscoverSearch signedIn={Boolean(user)} configured={Boolean(supabase)} verified={vendors.slice(0, 3).map((v) => ({ id: v.id, name: v.name, category: v.category, city: v.city, sample: v.sample }))} verifiedMode={mode} events={events} />
    </div>
  );
}
