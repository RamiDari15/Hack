'use server';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import templates from '@/data/workspaces/events.json';
import ideas from '@/data/workspaces/ideas.json';
const str=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function loadReadyMadeEvents(){
 const {supabase,user}=await getSessionUser();
 if(!supabase||!user)return {error:'Sign in to create your event plans.'};
 const {data,error}=await supabase.rpc('create_event_workspace',{templates});
 if(error)return {error:'Could not create the starter events. Please try again.'};
 for(const path of ['/dashboard','/account','/saved','/ideas','/inbox'])revalidatePath(path);
 return {ok:true,message:'Three event plans are ready, with vendors, guests, budgets and the day-of details.',href:`/events/${data[0].id}`};
}
export async function saveIdea(_previous,fd){
 const {supabase,user}=await getSessionUser();const idea=ideas.find(i=>i.key===fd.get('idea_key'));
 if(!supabase||!user)return {error:'Sign in to save ideas.'};
 if(!idea)return {error:'Idea not found.'};
 const event=str(fd.get('event_id'),36);
 if(event){
  if(!UUID_RE.test(event))return {error:'Choose an event.'};
  const {error}=await supabase.from('event_ideas').upsert({event_id:event,idea_key:idea.key,title:idea.title,note:idea.summary,added_by:user.id},{onConflict:'event_id,idea_key',ignoreDuplicates:true});
  if(error)return {error:'Could not add the idea to that event.'};
  revalidatePath(`/events/${event}`);revalidatePath(`/events/${event}/ideas`);
  return {ok:true,message:'Idea added to your event.',href:`/events/${event}/ideas`};
 }
 const saved=fd.get('save')!=='no';
 const result=saved?await supabase.from('saved_ideas').upsert({user_id:user.id,idea_key:idea.key},{onConflict:'user_id,idea_key',ignoreDuplicates:true}):await supabase.from('saved_ideas').delete().eq('user_id',user.id).eq('idea_key',idea.key);
 if(result.error)return {error:'Could not update your saved ideas.'};
 revalidatePath('/ideas');revalidatePath('/saved');return {ok:true,saved,message:saved?'Idea saved for later.':'Removed from saved ideas.'};
}
export async function addPlanningNote(_previous,fd){
 const {supabase,user}=await getSessionUser();const event=str(fd.get('event_id'),36),title=str(fd.get('title'),160),body=str(fd.get('body'),3000);
 if(!supabase||!user||!UUID_RE.test(event))return {error:'Choose one of your events.'};
 if(!title||!body)return {error:'Add a title and note.'};
 const {error}=await supabase.from('event_notes').insert({event_id:event,user_id:user.id,title,body});
 if(error)return {error:'Could not save the note.'};
 revalidatePath('/inbox');revalidatePath(`/events/${event}/notes`);return {ok:true,message:'Private note saved.'};
}
export async function completePlanningNote(fd){
 const {supabase,user}=await getSessionUser();const id=str(fd.get('id'),36);
 if(!supabase||!user||!UUID_RE.test(id))return;
 await supabase.from('event_notes').update({done:fd.get('done')==='yes'}).eq('id',id).eq('user_id',user.id);
 revalidatePath('/inbox');
 const event=str(fd.get('event_id'),36);if(UUID_RE.test(event))revalidatePath(`/events/${event}/notes`);
}

export async function duplicateEvent(_previous,fd){
 const {supabase,user}=await getSessionUser();const event=str(fd.get('event_id'),36);
 if(!supabase||!user||!UUID_RE.test(event))return {error:'Sign in and choose your event.'};
 const {data,error}=await supabase.rpc('copy_event',{p_event:event});
 if(error)return {error:'Only the event owner can duplicate this plan.'};
 revalidatePath('/dashboard');return {ok:true,message:'Plan duplicated. RSVP responses, bookings and invitations were not copied.',href:`/events/${data}`};
}
