'use client';
import Link from 'next/link';
import {useActionState} from 'react';
import {duplicateEvent} from '@/app/actions/workspace';
export default function DuplicateEvent({eventId}){const[state,action,pending]=useActionState(duplicateEvent,null);return <div className="stack-sm"><form action={action}><input type="hidden" name="event_id" value={eventId}/><button className="btn btn-sm btn-outline" disabled={pending}>{pending?'Copying…':'Duplicate this plan'}</button></form><div aria-live="polite">{state?.error&&<p className="fine" role="alert">{state.error}</p>}{state?.ok&&<p className="notice notice-ok">{state.message} <Link href={state.href}>Open the copy →</Link></p>}</div></div>;}
