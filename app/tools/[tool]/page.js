import {notFound,redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/supabase/server';
const TOOLS=['shortlist','guests','registry','timeline','website','package','board','team','ideas','notes'];
export default async function ToolEntry({params}){
 const {tool}=await params;if(!TOOLS.includes(tool))notFound();const {supabase,user}=await getSessionUser();
 if(!user)redirect(`/sign-in?next=/tools/${tool}`);
 const {data}=await supabase.from('events').select('id').order('created_at',{ascending:false}).limit(1);
 if(data?.[0])redirect(`/events/${data[0].id}/${tool}`);redirect(`/events/new?after=${tool}`);
}
