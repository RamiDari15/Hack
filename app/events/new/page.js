import EventForm from '@/components/EventForm';
import PageHead from '@/components/PageHead';
import { createEvent } from '../actions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { EVENT_TYPES } from '@/lib/categories';

export const metadata = { title: 'New event' };

export default async function NewEventPage({ searchParams }) {
  const sp = await searchParams;
  const type = EVENT_TYPES.includes(sp?.type) ? sp.type : 'Wedding';
  return (
    <div className="page wrap-narrow">
      <PageHead
        back={{ href: '/dashboard', label: 'Your events' }}
        title="Tell us about the day."
        lede="Only you can see this. You can change any of it later."
      />
      {!isSupabaseConfigured && <p className="notice notice-warn">The database is not connected, so events cannot be saved yet.</p>}
      <div className="panel panel-pop panel-glow"><EventForm action={createEvent} initial={{ eventType: type }} /></div>
    </div>
  );
}
