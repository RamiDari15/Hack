import {getSessionUser} from '@/lib/supabase/server';
import EventWorkspaceNav from '@/components/EventWorkspaceNav';
export default async function EventLayout({children,params}){
 const {id}=await params;const {supabase,user}=await getSessionUser();
 const {data}=supabase&&user?await supabase.from('events').select('id,title').order('created_at',{ascending:false}).limit(100):{data:[]};
 return <>{data?.some(e=>e.id===id)&&<EventWorkspaceNav eventId={id} events={data}/ >}{children}</>;
}
