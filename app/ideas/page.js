import Link from 'next/link';
import {getSessionUser} from '@/lib/supabase/server';
import PageHead from '@/components/PageHead';
import IdeaCard from '@/components/IdeaCard';
import ideas from '@/data/workspaces/ideas.json';
import DiscoverSearch from '@/app/discover/DiscoverSearch';
export const metadata={title:'Ideas'};
export default async function IdeasPage({searchParams}){
 const sp=await searchParams;const {supabase,user}=await getSessionUser();
 const [{data:events},{data:saved}]=supabase&&user?await Promise.all([supabase.from('events').select('id,title').order('created_at',{ascending:false}).limit(30),supabase.from('saved_ideas').select('idea_key')]):[{data:[]},{data:[]}];
 const savedIds=new Set((saved||[]).map(s=>s.idea_key));const category=typeof sp?.category==='string'?sp.category:'';
 const list=ideas.filter(i=>(!category||i.category===category)&&(sp?.saved!=='1'||savedIds.has(i.key)));
 return <div className="page wrap pg pg-ideas"><PageHead title="A little spark for your day." lede="Find a direction, save the details, and bring your favorite ideas into an event."><Link className="btn btn-outline" href="/ideas?saved=1">Your saved ideas</Link><Link className="btn" href="/events/new">Create an event</Link></PageHead>
  <nav className="chips filter-chips" aria-label="Idea collections"><Link className="chip" href="/ideas" aria-current={!category?'page':undefined}>All ideas</Link>{[...new Set(ideas.map(i=>i.category))].map(c=><Link key={c} className="chip" aria-current={category===c?'page':undefined} href={`/ideas?category=${encodeURIComponent(c)}`}>{c}</Link>)}</nav>
  {list.length?<div className="ideas-grid">{list.map(i=><IdeaCard key={i.key} idea={i} events={events||[]} signedIn={Boolean(user)} saved={savedIds.has(i.key)} eventId={(events||[]).find(e=>e.id===sp?.event)?.id}/>)}</div>:<div className="panel empty"><h2>No saved ideas yet</h2><p>Save a theme or detail from the collections to keep it here.</p><Link href="/ideas" className="btn">Explore ideas</Link></div>}
  <section className="stack-lg ideas-search" id="search"><PageHead title="Have something specific in mind?" size="display-3" lede="Explore more inspiration and businesses across the web, with links back to the source."/><DiscoverSearch signedIn={Boolean(user)} configured={Boolean(supabase)} verified={[]} events={events||[]} initialQuery={typeof sp?.q==='string'?sp.q.slice(0,300):''}/></section>
 </div>;
}
