// Populate the dedicated, private vendor walkthrough account. Create its Firebase
// login separately; this script never accepts, stores, or prints a password.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const args=process.argv.slice(2);
const arg=k=>args[args.indexOf(k)+1];
const project=arg('--project');
if(!args.includes('--apply')||!args.includes('--project')||!/^[a-z]{20}$/.test(project)) throw Error('Use --project REF --apply');
const uid='5a3e0000-0000-4000-8000-0000000000a3';
const vendor='5a3e0000-0000-4000-8000-0000000000b3';
const organizer='fd23d7de-73ea-4c32-bc2d-73696648b3c3';
const events=['f6eee028-b271-4a17-b961-d3d8d7b94124','346a0060-b4e3-4c00-b69a-057c8025bbbe','b341b074-eda4-4352-b8c9-7ed3ad7c5a64'];
const q=s=>`'${String(s).replaceAll("'","''")}'`;
const packages=[
  ['Family-style dinner · 50 guests',425000,'Two seasonal mains, three sides, salad, bread and two hours of staffed dinner service for 50 guests. Additional guests $85 each.'],
  ['Signature reception · 75 guests',787500,'Passed appetizers, family-style dinner, dessert station, six service staff and four hours of service for 75 guests. Additional guests $105 each.'],
  ['Cocktail gathering · 30 guests',195000,'Six small bites, grazing table, nonalcoholic drinks and two attendants for a three-hour gathering. Additional guests $65 each.'],
  ['Menu tasting for two',15000,'A private tasting with two mains, three sides and a menu consultation. Applied to the balance when you book.'],
];
const threads=[
  ['inquiry','We are planning a garden reception for 72 guests. Could you suggest a seasonal menu with vegetarian and gluten-free choices?','Absolutely. A shared-table menu with a roasted vegetable main would work well. I can prepare a detailed proposal once you confirm the service time.'],
  ['quote','We need an easy-to-eat dinner for 120 people at Campus Creators Night. Can you include clear allergen labels?','I have sent a $7,800 proposal for staffed food stations, compostable serviceware and allergen labels. The menu includes two vegetarian options.'],
  ['confirmed','The cocktail gathering menu looks great. We would like to move forward for 32 guests.','Your date is on our calendar. Setup starts at 4:30 PM, guests arrive at 6 PM, and the final headcount is due seven days beforehand.'],
];
const sql=`begin;
create temporary table prior_outbox on commit drop as select id from public.email_outbox;
do $$ begin
 if not exists(select 1 from auth.users where id='${uid}' and email='long-table@vendora-sample.test') then raise exception 'Create the dedicated Firebase login and sign in once first.'; end if;
 if (select count(*) from public.events where id in (${events.map(q).join(',')}) and owner_id='${organizer}')<>3 then raise exception 'The three presentation events must exist and belong to the intended organizer.'; end if;
end $$;
update public.profiles set display_name='Jordan Ellis · Long Table Catering', roles='{vendor}', email_alerts=false where id='${uid}';
insert into public.vendors(id,owner_id,name,category,city,service_radius_mi,description,contact_email,phone,website,legal_name,setup_requirements,booking_policy,directory_listed,calendar_is_demo)
values('${vendor}','${uid}','Sample Long Table Catering','Catering','Ann Arbor, MI',40,
 'A fictional catering studio for the private Vendora walkthrough. Seasonal family-style dinners, cocktail gatherings and staffed campus events for 20–150 guests. Jordan leads a six-person service team, with vegetarian and gluten-free menus available by arrangement.',
 'long-table@vendora-sample.test','(734) 555-0148','https://long-table.example.test','Long Table Catering — presentation business',
 'Allow 90 minutes for setup and 45 minutes for cleanup. We need a sheltered prep area, potable water, two dedicated 120V outlets and vehicle access within 100 feet. We bring service equipment; tables and seating are arranged separately.',
 'A 25% deposit reserves the date after the quote is accepted. Final guest count is due seven days before the event and the remaining balance is due 14 days before service. Dietary requirements must be confirmed in advance. Travel beyond 25 miles is quoted separately.',false,true)
on conflict(id) do nothing;
${packages.map(([title,cents,description])=>`insert into public.vendor_packages(vendor_id,title,price_cents,description) select '${vendor}',${q(title)},${cents},${q(description)} where not exists(select 1 from public.vendor_packages where vendor_id='${vendor}' and title=${q(title)});`).join('\n')}
${threads.map(([status,customer,reply],i)=>`
insert into public.event_vendors(event_id,vendor_id,status) values('${events[i]}','${vendor}',${q(status)}) on conflict(event_id,vendor_id) do nothing;
insert into public.messages(event_vendor_id,sender_id,body,created_at)
select b.id,m.sender::uuid,m.body,now()-m.age*interval '1 hour' from public.event_vendors b cross join(values('${organizer}',${q(customer)},${12+i*6}),('${uid}',${q(reply)},${10+i*6})) m(sender,body,age)
where b.event_id='${events[i]}' and b.vendor_id='${vendor}' and not exists(select 1 from public.messages x where x.event_vendor_id=b.id and x.body=m.body);
`).join('\n')}
insert into public.quotes(event_vendor_id,amount_cents,description,valid_until,status)
select b.id,case when b.event_id='${events[1]}' then 780000 else 208000 end,
case when b.event_id='${events[1]}' then 'Campus food stations for 120 guests: seasonal bowls, two vegetarian options, allergen labels, serviceware, staffing and cleanup.' else 'Cocktail gathering for 32 guests: six small bites, grazing table, nonalcoholic drinks and two attendants. Service 6–9 PM.' end,
current_date+30,case when b.event_id='${events[1]}' then 'sent' else 'accepted' end
from public.event_vendors b where b.vendor_id='${vendor}' and b.event_id in ('${events[1]}','${events[2]}') and not exists(select 1 from public.quotes x where x.event_vendor_id=b.id);
insert into public.invoices(event_vendor_id,kind,amount_cents,due_date,note,status)
select b.id,'deposit',52000,current_date+14,'Presentation invoice record only; no payment has been collected.','due' from public.event_vendors b where b.vendor_id='${vendor}' and b.event_id='${events[2]}' and not exists(select 1 from public.invoices x where x.event_vendor_id=b.id and x.kind='deposit');
insert into public.invoices(event_vendor_id,kind,amount_cents,due_date,note,status)
select b.id,'final',156000,e.event_date-14,'Remaining balance for the cocktail gathering.','due' from public.event_vendors b join public.events e on e.id=b.event_id where b.vendor_id='${vendor}' and b.event_id='${events[2]}' and not exists(select 1 from public.invoices x where x.event_vendor_id=b.id and x.kind='final');
insert into public.vendor_calendar_entries(vendor_id,starts_at,ends_at,status,title,is_demo)
select '${vendor}',(e.event_date+time '16:30') at time zone 'America/Detroit',(e.event_date+time '22:00') at time zone 'America/Detroit',case when b.status='confirmed' then 'booked' else 'tentative' end,
case when e.id='${events[0]}' then 'Garden reception · menu consultation' when e.id='${events[1]}' then 'Campus Creators Night · proposal pending' else 'Riverside birthday · cocktail service' end,true
from public.event_vendors b join public.events e on e.id=b.event_id where b.vendor_id='${vendor}' and e.id in(${events.map(q).join(',')}) on conflict(vendor_id,starts_at) do nothing;
insert into public.vendor_calendar_entries(vendor_id,starts_at,ends_at,status,title,is_demo)
select '${vendor}',(current_date+3+time '14:00') at time zone 'America/Detroit',(current_date+3+time '16:00') at time zone 'America/Detroit','tentative','Seasonal menu tasting',true
where not exists(select 1 from public.vendor_calendar_entries where vendor_id='${vendor}' and title='Seasonal menu tasting');
insert into public.vendor_calendar_entries(vendor_id,starts_at,ends_at,status,title,is_demo)
select '${vendor}',(current_date+7+time '08:00') at time zone 'America/Detroit',(current_date+7+time '17:00') at time zone 'America/Detroit','blocked','Kitchen maintenance and team training',true
where not exists(select 1 from public.vendor_calendar_entries where vendor_id='${vendor}' and title='Kitchen maintenance and team training');
-- Leave in-app notifications, but remove only email jobs made by this seed before
-- commit. No worker can see these uncommitted jobs, so no demo mail is sent.
delete from public.email_outbox o where not exists(select 1 from prior_outbox p where p.id=o.id) and o.link in(select '/bookings/'||id from public.event_vendors where vendor_id='${vendor}');
commit;
select 'Private vendor workspace populated' as result;`;
const dir=mkdtempSync(join(tmpdir(),'vendora-vendor-seed-'));
try{
 const path=join(dir,'seed.sql');writeFileSync(path,sql,{mode:0o600});
 const out=execFileSync('supabase',['db','query','--linked','--project-ref',project,'--file',path,'--yes','--output-format','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 console.log(JSON.stringify(JSON.parse(out).rows));
}finally{rmSync(dir,{recursive:true,force:true});}
