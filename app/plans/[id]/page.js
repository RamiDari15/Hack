import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import PlanView from '@/components/plan/PlanView';

export const metadata = { title: 'Your plan' };

// A saved AI plan, reopened from the account page, with the same tools as on the planner.
export default async function PlanPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/planner');
  if (!user) redirect(`/sign-in?next=/plans/${id}`);
  const [{ data: row }, { data: events }] = await Promise.all([
    supabase.from('ai_requests').select('id, output, event_id, created_at').eq('id', id).eq('kind', 'plan').maybeSingle(),
    supabase.from('events').select('id, title, event_date').order('created_at', { ascending: false }).limit(30),
  ]);
  if (!row?.output?.categories) notFound();
  return (
    <div className="page wrap-narrow">
      <a className="back-link" href="/account#plans-h">Your account</a>
      <PlanView plan={row.output} planId={row.id} eventId={row.event_id} events={events ?? []} />
    </div>
  );
}
