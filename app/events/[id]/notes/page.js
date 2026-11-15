import {notFound,redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import ActionForm from '@/components/forms/ActionForm';
import {addPlanningNote,completePlanningNote} from '@/app/actions/workspace';
export const metadata={title:'Planning notes'};
export default async function NotesPage({params}){
 const {id}=await params;const {supabase,user}=await getSessionUser();if(!user)redirect(`/sign-in?next=/events/${id}/notes`);
 const [{data:event},{data:notes}]=await Promise.all([supabase.from('events').select('id,title').eq('id',id).maybeSingle(),supabase.from('event_notes').select('*').eq('event_id',id).order('created_at',{ascending:false})]);if(!event)notFound();
 return <div className="page wrap ev"><PageHead title="Keep the little details." lede="Private planning notes and draft questions, shared only with people on this event." size="display-2"/>
 <div className="event-layout"><div className="stack">{notes?.map(n=><article className={`panel stack-sm${n.done?' note-done':''}`} key={n.id}><div className="between"><h2 className="title">{n.title}</h2><span className="fine">{n.done?'Done':'Private note'}</span></div><p className="small" style={{whiteSpace:'pre-wrap'}}>{n.body}</p>{n.user_id===user.id&&<form action={completePlanningNote}><input type="hidden" name="id" value={n.id}/><input type="hidden" name="event_id" value={id}/><input type="hidden" name="done" value={n.done?'no':'yes'}/><button className="btn btn-sm btn-outline">{n.done?'Reopen':'Mark done'}</button></form>}</article>)}{!notes?.length&&<div className="panel empty"><h2>Make room for the details</h2><p>Save a vendor question, a menu decision or a day-of reminder.</p></div>}</div>
 <aside className="panel stack"><h2 className="title">Add a note</h2><ActionForm action={addPlanningNote} resetOnOk><input type="hidden" name="event_id" value={id}/><div className="field"><label htmlFor="note-title">Title</label><input id="note-title" name="title" required maxLength={160}/></div><div className="field"><label htmlFor="note-body">Details</label><textarea id="note-body" name="body" required maxLength={3000}/></div><button className="btn">Save note</button></ActionForm></aside></div></div>;
}
