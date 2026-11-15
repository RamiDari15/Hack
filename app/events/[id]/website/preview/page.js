import {notFound,redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/supabase/server';
import EventWebsiteView from '@/components/EventWebsiteView';
export const metadata={title:'Website preview',robots:{index:false}};
export default async function WebsitePreview({params}){
 const {id}=await params;const {supabase,user}=await getSessionUser();if(!user)redirect(`/sign-in?next=/events/${id}/website/preview`);
 const [{data:event},{data:timeline},{data:registry}]=await Promise.all([
 supabase.from('events').select('title,event_type,event_date,location,website_intro,guest_list_enabled,registry_enabled').eq('id',id).maybeSingle(),
 supabase.from('event_timeline_items').select('start_time,end_time,title').eq('event_id',id).eq('show_on_website',true).order('start_time'),
 supabase.from('event_registry_items').select('title,url,price_note,quantity,registry_claims(quantity)').eq('event_id',id)]);
 if(!event)notFound();
 const site={...event,intro:event.website_intro,rsvp_open:event.guest_list_enabled,registry_open:event.registry_enabled,schedule:(timeline||[]).map(t=>({start:t.start_time,end:t.end_time,title:t.title})),registry:(registry||[]).map(r=>({...r,remaining:Math.max(0,r.quantity-(r.registry_claims||[]).reduce((n,c)=>n+c.quantity,0))}))};
 return <EventWebsiteView site={site} preview/>;
}
