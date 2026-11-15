// Populate only the requested account. Normal RLS applies inside the workspace RPC.
// Usage: node --conditions=react-server scripts/seed-presentation-workspace.mjs --email USER --project REF --apply [--weather]
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
const email=args.includes('--email')?get('--email'):'';
const project=args.includes('--project')?get('--project'):'';
if(!/^\S+@\S+\.\S+$/.test(email)||!/^[a-z]{20}$/.test(project)||!args.includes('--apply'))throw Error('Explicit --email, --project and --apply are required.');
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const templates=JSON.parse(readFileSync(new URL('../data/workspaces/events.json',import.meta.url),'utf8'));
const directory=mkdtempSync(join(tmpdir(),'vendora-workspace-'));
function query(sql){const path=join(directory,'query.sql');writeFileSync(path,sql,{mode:0o600});const result=execFileSync('supabase',['db','query','--linked','--project-ref',project,'--file',path,'--yes','--output-format','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});return JSON.parse(result).rows;}
try{
 const user=query(`select id from auth.users where lower(email)=lower(${quote(email)})`)[0];
 if(!user)throw Error('This account must sign in once before its event workspace can be populated.');
 const uid=user.id;
 query(`begin;
 select set_config('request.jwt.claim.sub',${quote(uid)},true);
 select set_config('request.jwt.claims',${quote(JSON.stringify({sub:uid,role:'authenticated',email}))},true);
 set local role authenticated;
 select public.create_event_workspace(${quote(JSON.stringify(templates))}::jsonb);
 reset role;
 -- These describe an action that really happened. Presentation setup does not send email.
 create temporary table created_workspace_alerts on commit drop as
 with added as(insert into public.notifications(user_id,title,link)
 select ${quote(uid)}::uuid,'Your plan is ready: '||e.title,'/events/'||e.id from public.events e
 where e.owner_id=${quote(uid)} and e.workspace_key in ('garden-wedding-v1','creators-night-v1','riverside-birthday-v1')
 and not exists(select 1 from public.notifications n where n.user_id=e.owner_id and n.link='/events/'||e.id and n.title='Your plan is ready: '||e.title)
 returning id) select id from added;
 delete from public.email_outbox where notification_id in(select id from created_workspace_alerts);
 commit;
 select id,title,workspace_key from public.events where owner_id=${quote(uid)} and workspace_key is not null order by workspace_key;`);
 if(args.includes('--weather')){
  try{
   const {fetchNasaHistory}=await import('../lib/weather-history.js');
   const originalFetch=globalThis.fetch,cache=new Map();
   globalThis.fetch=async(...values)=>{const key=String(values[0]);if(!cache.has(key))cache.set(key,originalFetch(...values));return (await cache.get(key)).clone();};
   for(const event of templates){const summary=await fetchNasaHistory({latitude:event.latitude,longitude:event.longitude,eventDate:event.event_date});
    query(`insert into public.event_weather(event_id,event_date,latitude,longitude,place_note,summary)
     select id,event_date,latitude,longitude,'Ann Arbor city center',${quote(JSON.stringify(summary))}::jsonb from public.events where owner_id=${quote(uid)} and workspace_key=${quote(event.key)}
     on conflict(event_id) do update set event_date=excluded.event_date,summary=excluded.summary,fetched_at=now();`);
   }
   globalThis.fetch=originalFetch;console.log('Cached real NASA POWER weather history for all three event dates.');
  }catch(error){console.log('Weather remains available on demand:',error.message);}
 }
 const result=query(`select e.id,e.title,
 (select count(*) from public.event_guests g where g.event_id=e.id) guests,
 (select count(*) from public.event_shortlist s where s.event_id=e.id) vendors,
 (select count(*) from public.event_timeline_items t where t.event_id=e.id) timeline,
 (select count(*) from public.event_notes n where n.event_id=e.id) notes,
 (select count(*) from public.event_registry_items r where r.event_id=e.id) registry,
 (select count(*) from public.style_board_items b where b.event_id=e.id) board
 from public.events e where e.owner_id=${quote(uid)} and e.workspace_key is not null order by e.workspace_key;`);
 console.log(JSON.stringify(result,null,2));
}finally{rmSync(directory,{recursive:true,force:true});}
