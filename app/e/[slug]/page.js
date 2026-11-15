import EventWebsiteView from '@/components/EventWebsiteView';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

export const metadata = { title: 'Event', robots: { index: false } };



// Public event website. Shows only what event_website() returns: no guest names, vendors or budget.
export default async function EventWebsite({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: site } = await supabase.rpc('event_website', { s: slug });
  if (!site) notFound();
  const guestToken = UUID_RE.test(sp?.g ?? '') ? sp.g : null;

  return <EventWebsiteView site={site} guestToken={guestToken}/>;
}
