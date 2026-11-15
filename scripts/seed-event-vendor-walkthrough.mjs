// Private fictional counterparts for the categories on one customer's three
// presentation events. Never claims or changes any real directory business.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2), project=args[args.indexOf('--project')+1];
if(!args.includes('--apply')||!args.includes('--project')||!/^[a-z]{20}$/.test(project)) throw Error('Use --project REF --apply');
const owner='5a3e0000-0000-4000-8000-0000000000a3',customer='fd23d7de-73ea-4c32-bc2d-73696648b3c3',caterer='5a3e0000-0000-4000-8000-0000000000b3';
const fixtures=JSON.parse(readFileSync(new URL('../data/workspaces/vendor-businesses.json',import.meta.url)));
const q=x=>`'${String(x).replaceAll("'","''")}'`;
const uuid=key=>{const h=createHash('sha256').update('vendora-private-vendor:'+key).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const sql=`begin;
do $$ begin
 if not exists(select 1 from auth.users where id='${customer}' and email='ramidari15@gmail.com') then raise exception 'Intended customer identity not found'; end if;
 if not exists(select 1 from public.vendors where id='${caterer}' and owner_id='${owner}' and calendar_is_demo and not directory_listed) then raise exception 'Seed the dedicated catering account first'; end if;
end $$;
create temporary table walkthrough_events on commit drop as select id,event_date,guest_count from public.events where owner_id='${customer}' and id in('f6eee028-b271-4a17-b961-d3d8d7b94124','346a0060-b4e3-4c00-b69a-057c8025bbbe','b341b074-eda4-4352-b8c9-7ed3ad7c5a64');
create temporary table walkthrough_categories on commit drop as select distinct s.event_id,v.category from public.event_shortlist s join public.vendors v on v.id=s.vendor_id join walkthrough_events e on e.id=s.event_id where v.directory_listed;
insert into public.vendor_walkthrough_access(vendor_id,customer_id) values('${caterer}','${customer}') on conflict do nothing;
insert into public.event_shortlist(event_id,vendor_id,added_by) select e.id,'${caterer}','${customer}' from walkthrough_events e on conflict(event_id,vendor_id) do nothing;
${fixtures.map((v,i)=>{
 const id=uuid(v.category);
 return `
insert into public.vendors(id,owner_id,name,category,city,service_radius_mi,description,setup_requirements,booking_policy,contact_email,phone,calendar_is_demo,directory_listed)
values('${id}','${owner}',${q(v.name)},${q(v.category)},'Ann Arbor, MI',40,${q('Fictional business for your private Vendora walkthrough. '+v.includes)},${q(v.setup)},'A 25% deposit reserves the date after quote acceptance. Final details are due 14 days before service. Additional hours and travel are agreed in writing. No payment is taken through this sample profile.','long-table@vendora-sample.test','(734) 555-0148',true,false)
on conflict(id) do nothing;
insert into public.vendor_walkthrough_access(vendor_id,customer_id) values('${id}','${customer}') on conflict do nothing;
${[['Essential',v.price,v.package+' — '+v.includes],['Signature',Math.round(v.price*1.35),'Essential service plus extended coverage, a planning session and upgraded presentation. Scope and schedule confirmed in the quote.'],['Custom',null,'A tailored proposal for a different guest count, venue or service duration. Share your event details for a written quote.']].map(([title,price,description])=>`insert into public.vendor_packages(vendor_id,title,price_cents,description) select '${id}',${q(title)},${price??'null'},${q(description)} where not exists(select 1 from public.vendor_packages where vendor_id='${id}' and title=${q(title)});`).join('\n')}
insert into public.event_shortlist(event_id,vendor_id,added_by) select c.event_id,'${id}','${customer}' from walkthrough_categories c where c.category=${q(v.category)} on conflict(event_id,vendor_id) do nothing;
${v.category==='Photography'?'-- Photography intentionally has no inquiry, ready for a live customer request.':`
insert into public.event_vendors(event_id,vendor_id,status)
select c.event_id,'${id}',${q(i%3===0?'confirmed':i%3===1?'inquiry':'quote')} from walkthrough_categories c where c.category=${q(v.category)} on conflict(event_id,vendor_id) do nothing;
insert into public.messages(event_vendor_id,sender_id,body,created_at)
select b.id,m.sender::uuid,m.body,now()-m.age*interval '1 hour' from public.event_vendors b cross join(values
 ('${customer}',${q(`Could you share your ${v.category.toLowerCase()} options for our event? We would like to confirm the scope, arrival time and total price.`)},36),
 ('${owner}',${q(`Thanks for your inquiry. Our ${v.package.toLowerCase()} includes ${v.includes} I can adjust the scope after we review your timeline.`)},24)
) m(sender,body,age) where b.vendor_id='${id}' and b.event_id in(select id from walkthrough_events) and not exists(select 1 from public.messages x where x.event_vendor_id=b.id and x.body=m.body);
${i%3===1?'':`
insert into public.quotes(event_vendor_id,amount_cents,description,valid_until,status)
select b.id,${v.price},${q(v.package+' — '+v.includes)},current_date+30,case when b.status='confirmed' then 'accepted' else 'sent' end from public.event_vendors b where b.vendor_id='${id}' and b.event_id in(select id from walkthrough_events) and not exists(select 1 from public.quotes x where x.event_vendor_id=b.id);
`}`}
insert into public.vendor_calendar_entries(vendor_id,starts_at,ends_at,status,title,is_demo)
select '${id}',(e.event_date+time '14:00') at time zone 'America/Detroit',(e.event_date+time '22:00') at time zone 'America/Detroit',coalesce(case when b.status='confirmed' then 'booked' else 'tentative' end,'tentative'),${q(v.category+' · event service window')},true
from walkthrough_categories c join walkthrough_events e on e.id=c.event_id left join public.event_vendors b on b.event_id=e.id and b.vendor_id='${id}' where c.category=${q(v.category)} on conflict(vendor_id,starts_at) do nothing;
`;
}).join('\n')}
commit;
select count(*)::int as private_businesses from public.vendor_walkthrough_access where customer_id='${customer}';`;
const dir=mkdtempSync(join(tmpdir(),'vendora-event-vendors-'));
try{
 const path=join(dir,'seed.sql');writeFileSync(path,sql,{mode:0o600});
 const out=execFileSync('supabase',['db','query','--linked','--project-ref',project,'--file',path,'--yes','--output-format','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 console.log(JSON.stringify(JSON.parse(out).rows));
}catch(e){console.error(e.stderr?.toString()||e.message);process.exitCode=1;}
finally{rmSync(dir,{recursive:true,force:true});}
