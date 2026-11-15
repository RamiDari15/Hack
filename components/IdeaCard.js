'use client';
import {useActionState,useId} from 'react';
import Link from 'next/link';
import {saveIdea} from '@/app/actions/workspace';
export default function IdeaCard({idea,events=[],signedIn=false,saved=false,eventId=''}){
 const id=useId();const [save,saveAction,pendingSave]=useActionState(saveIdea,null);const [add,addAction,pendingAdd]=useActionState(saveIdea,null);
 const current=save?.saved??saved;
 return <article className="idea-card panel stack" id={idea.key}>
  <div className={`idea-art idea-art-${idea.tone}`} aria-hidden="true"><span>{idea.icon}</span><div className="idea-palette">{idea.palette.map(c=><i key={c} style={{background:c}}/>)}</div></div>
  <div className="stack-sm"><span className="label">{idea.category}</span><h2 className="title">{idea.title}</h2><p className="small muted">{idea.summary}</p></div>
  <ul className="small idea-checklist">{idea.tasks.map(t=><li key={t}>{t}</li>)}</ul>
  {signedIn?<><form action={saveAction}><input type="hidden" name="idea_key" value={idea.key}/><input type="hidden" name="save" value={current?'no':'yes'}/><button className="btn btn-sm btn-outline" aria-pressed={current} disabled={pendingSave}>{current?'♥ Saved for later':'♡ Save for later'}</button></form>
   {events.length>0&&<form action={addAction} className="stack-sm"><input type="hidden" name="idea_key" value={idea.key}/><label htmlFor={`${id}-event`} className="fine">Add to an event</label><select id={`${id}-event`} name="event_id" defaultValue={eventId||events[0].id}>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select><button className="btn btn-sm" disabled={pendingAdd}>{pendingAdd?'Adding…':'Add idea to event'}</button></form>}
  </>:<Link className="btn btn-sm btn-outline" href="/sign-in?next=/ideas">Save this idea</Link>}
  <Link className="small" href={`/events/new?idea=${idea.key}`}>Create an event around this →</Link>
  <div aria-live="polite">{(save?.error||add?.error)&&<p className="notice notice-error">{save?.error||add?.error}</p>}{add?.ok&&<p className="notice notice-ok">{add.message} <Link href={add.href}>Open event ideas →</Link></p>}</div>
 </article>;
}
