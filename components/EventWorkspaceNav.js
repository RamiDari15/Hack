'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
const TABS=[['','Overview'],['shortlist','Vendors'],['walk','3D walk'],['package','Budget'],['quotes','Compare pricing'],['guests','Guests & RSVPs'],['seating','Seating'],['timeline','Timeline'],['ideas','Ideas'],['board','Style board'],['registry','Registry'],['notes','Notes'],['team','Team'],['website','Website']];
export default function EventWorkspaceNav({eventId,events}){
 const pathname=usePathname(),router=useRouter();const current=pathname.split('/')[3]||'';
 return <div className="wrap workspace-navigation"><div className="between"><div className="field workspace-switcher"><label htmlFor="workspace-event">Your event</label><select id="workspace-event" value={eventId} onChange={e=>router.push(`/events/${e.target.value}${current?`/${current}`:''}`)}>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></div><Link className="btn btn-sm btn-outline" href="/events/new">＋ New event</Link></div>
 <nav className="workspace-tabs" aria-label="Event tools">{TABS.map(([path,label])=><Link key={path} href={`/events/${eventId}${path?`/${path}`:''}`} aria-current={current===path?'page':undefined}>{label}</Link>)}</nav></div>;
}
