import ideas from '@/data/workspaces/ideas.json';
import { UUID_RE } from '@/lib/format';
import EventForm from '@/components/EventForm';
import PageHead from '@/components/PageHead';
import { createEvent } from '../actions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { EVENT_TYPES } from '@/lib/categories';

export const metadata = { title: 'New event' };

export default async function NewEventPage({ searchParams }) {
  const sp = await searchParams;
  const idea=ideas.find(i=>i.key===sp?.idea);
  const after=['shortlist','guests','registry','timeline','website','package','board','team','ideas','notes'].includes(sp?.after)?sp.after:'';
  const vendorId=UUID_RE.test(sp?.vendor||'')?sp.vendor:'';
  const type = EVENT_TYPES.includes(sp?.type) ? sp.type : 'Wedding';
  return (
    <div className="page wrap-narrow ev">
      <PageHead
        back={{ href: '/dashboard', label: 'Your events' }}
        title="Tell us about the day."
        lede="Only you can see this. You can change any of it later."
      />
      {!isSupabaseConfigured && <p className="notice notice-warn">The database is not connected, so events cannot be saved yet.</p>}
      <div className="panel panel-pop panel-glow"><EventForm action={createEvent} initial={{ eventType: idea?.event_type||type, title:idea?.title||'', guests:idea?.guests||'', budget:idea?.budget||'', style:idea?.category||'', ideaKey:idea?.key||'', after, vendorId }} /></div>
    </div>
  );
}
