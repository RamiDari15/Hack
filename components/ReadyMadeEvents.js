'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { loadReadyMadeEvents } from '@/app/actions/workspace';
export default function ReadyMadeEvents(){
 const [state,action,pending]=useActionState(loadReadyMadeEvents,null);
 return <div className="panel starter-workspace stack"><h2 className="title">Three celebrations, already taking shape.</h2>
 <p className="small">A garden wedding, a campus creators night and a riverside birthday—with guests, seating, timelines, wishlists and vendor shortlists you can make your own.</p>
 <form action={action}><button className="btn btn-sm" disabled={pending}>{pending?'Preparing your events…':'Add ready-made event plans'}</button></form>
 <div aria-live="polite">{state?.error&&<p role="alert" className="notice notice-error">{state.error}</p>}{state?.ok&&<p className="notice notice-ok">{state.message} <Link href={state.href}>Open the first event →</Link></p>}</div></div>;
}
