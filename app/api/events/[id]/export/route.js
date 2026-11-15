import {getSessionUser} from '@/lib/supabase/server';
import {UUID_RE} from '@/lib/format';
import {csvDocument} from '@/lib/csv';
export async function GET(request,{params}){
 const {id}=await params;if(!UUID_RE.test(id))return new Response('Not found',{status:404});
 const {supabase,user}=await getSessionUser();if(!supabase||!user)return new Response('Sign in first',{status:401});
 const {data:event}=await supabase.from('events').select('id,title,starter_plan').eq('id',id).maybeSingle();if(!event)return new Response('Not found',{status:404});
 const type=new URL(request.url).searchParams.get('type');let headers,rows;
 if(type==='guests'){
  const {data,error}=await supabase.from('event_guests').select('name,email,party_size,status,attending,meal,dietary').eq('event_id',id).order('name');if(error)return new Response('Export unavailable',{status:503});
  headers=['Guest','Email','Party size','RSVP','Attending','Meal','Dietary notes'];rows=(data||[]).map(g=>[g.name,g.email,g.party_size,g.status,g.attending,g.meal,g.dietary]);
 }else if(type==='timeline'){
  const {data,error}=await supabase.from('event_timeline_items').select('start_time,end_time,title,notes').eq('event_id',id).order('start_time');if(error)return new Response('Export unavailable',{status:503});
  headers=['Start','End','Activity','Notes'];rows=(data||[]).map(t=>[t.start_time,t.end_time,t.title,t.notes]);
 }else if(type==='vendors'||type==='budget'){
  let query=supabase.from('event_shortlist').select('planned_cents,in_package,pricing_selection,vendors(name,category,city,website)').eq('event_id',id);if(type==='budget')query=query.eq('in_package',true);
  const {data,error}=await query;if(error)return new Response('Export unavailable',{status:503});
  headers=['Business','Category','City','In package','Planning amount (USD)','Option','Quantity','Source','Website'];rows=(data||[]).map(v=>[v.vendors?.name,v.vendors?.category,v.vendors?.city,v.in_package?'Yes':'No',v.planned_cents==null?'':v.planned_cents/100,v.pricing_selection?.title,v.pricing_selection?.quantity,v.pricing_selection?.source||'Your plan',v.vendors?.website]);
 }else return new Response('Choose guests, timeline, vendors or budget',{status:400});
 const filename=event.title.replace(/[^a-z0-9]+/ig,'-').replace(/^-|-$/g,'').slice(0,60)||'event';
 return new Response(csvDocument(headers,rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}-${type}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
