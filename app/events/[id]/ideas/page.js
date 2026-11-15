import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import IdeaCard from '@/components/IdeaCard';
import ideas from '@/data/workspaces/ideas.json';
export const metadata={title:'Event ideas'};
export default async function EventIdeas({params}){
 const {id}=await params;const {supabase,user}=await getSessionUser();if(!user)redirect(`/sign-in?next=/events/${id}/ideas`);
 const [{data:event},{data:rows},{data:saved}]=await Promise.all([supabase.from('events').select('id,title').eq('id',id).maybeSingle(),supabase.from('event_ideas').select('idea_key').eq('event_id',id),supabase.from('saved_ideas').select('idea_key')]);if(!event)notFound();
 const selected=new Set((rows||[]).map(r=>r.idea_key)),savedIds=new Set((saved||[]).map(r=>r.idea_key));
 return <div className="page wrap ev"><PageHead title="Ideas for this day" lede="Your palette, atmosphere and little details, all kept with the event." size="display-2"><Link className="btn" href={`/ideas?event=${id}`}>Find more ideas</Link><Link className="btn btn-outline" href={`/events/${id}/board`}>Open style board</Link></PageHead>
 {selected.size?<div className="ideas-grid">{ideas.filter(i=>selected.has(i.key)).map(i=><IdeaCard key={i.key} idea={i} signedIn saved={savedIds.has(i.key)} events={[event]} eventId={id}/>)}</div>:<div className="panel empty"><h2>Start with a feeling.</h2><p>Pick a theme or detail from Ideas and add it to this event.</p><Link href={`/ideas?event=${id}`} className="btn">Explore ideas</Link></div>}</div>;
}
