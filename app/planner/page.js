import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PageHead from '@/components/PageHead';
import PlannerForm from './PlannerForm';

export const metadata = { title: 'Planner' };

export default async function PlannerPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  let events = [];
  if (supabase && user) {
    const { data } = await supabase.from('events').select('id, title, event_type, event_date, location, guest_count, budget_cents, style').order('created_at', { ascending: false }).limit(30);
    events = data ?? [];
  }
  const selected = UUID_RE.test(sp?.event ?? '') ? sp.event : '';

  return (
    <div className="page wrap">
      <PageHead title="Ask the planner." lede="Describe the event in plain words. You get a budget split, the assumptions behind it, what you might be missing, and a checklist." />
      <p className="notice notice-warn">Every figure here is an AI estimate, not a price. Vendor quotes replace estimates once they arrive. Nothing is booked, paid or sent from this page.</p>
      <PlannerForm events={events} initialEventId={selected} signedIn={Boolean(user)} configured={Boolean(supabase)} />
    </div>
  );
}
