// Give one account a few sample vendor conversations, so the inbox has something in it for a walkthrough.
// The three vendors are fictional, named "Sample …", use .test addresses and have no password, so nobody can
// sign in as them and nothing reaches a real business. They stay unverified and out of the public directory.
//
// Usage (hosted project):  node scripts/seed-sample-inbox.mjs --email YOU@EXAMPLE.COM --project REF --apply
// Usage (local Supabase):  node scripts/seed-sample-inbox.mjs --email YOU@EXAMPLE.COM --local --apply
// Remove them again:       add --remove (deletes the three sample vendors and their threads; your events stay)
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : '');
const email = get('--email');
const project = get('--project');
const local = args.includes('--local');
if (!/^\S+@\S+\.\S+$/.test(email) || (!local && !/^[a-z]{20}$/.test(project)) || !args.includes('--apply')) {
  throw Error('Explicit --email, --apply and either --project REF or --local are required.');
}
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const dir = mkdtempSync(join(tmpdir(), 'vendora-inbox-'));

function query(sql) {
  const path = join(dir, 'query.sql');
  writeFileSync(path, sql, { mode: 0o600 });
  if (local) {
    const env = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
    const url = env.match(/^DB_URL="?([^"\n]+)"?/m)?.[1];
    if (!url) throw Error('Local Supabase is not running. Start it with: supabase start');
    const out = execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-At', '-f', path], { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return l; } });
  }
  const out = execFileSync('supabase', ['db', 'query', '--linked', '--project-ref', project, '--file', path, '--yes', '--output-format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out).rows;
}

// Fixed ids, so running the script twice changes nothing and --remove finds exactly these rows.
const VENDORS = [
  { user: '5a3e0000-0000-4000-8000-0000000000a1', vendor: '5a3e0000-0000-4000-8000-0000000000b1', name: 'Sample Petal & Stem', category: 'Florists', mail: 'petal-and-stem@vendora-sample.test' },
  { user: '5a3e0000-0000-4000-8000-0000000000a2', vendor: '5a3e0000-0000-4000-8000-0000000000b2', name: 'Sample Night Shift DJs', category: 'Music & DJ', mail: 'night-shift@vendora-sample.test' },
  { user: '5a3e0000-0000-4000-8000-0000000000a3', vendor: '5a3e0000-0000-4000-8000-0000000000b3', name: 'Sample Long Table Catering', category: 'Catering', mail: 'long-table@vendora-sample.test' },
];
const ids = (k) => VENDORS.map((v) => q(v[k])).join(',');

try {
  if (args.includes('--remove')) {
    query(`begin;
      delete from public.vendors where id in (${ids('vendor')});
      delete from auth.users where id in (${ids('user')});
      commit;`);
    console.log('Removed the three sample vendors and their conversations.');
    process.exit(0);
  }

  // Threads: [vendor index, status, messages as [fromVendor, text, hoursAgo]]. The newest one is from the vendor,
  // so it shows as unread.
  const THREADS = [
    [0, 'quote', [
      [false, 'Hi! Do you have time for our date? We are thinking soft pinks and lots of greenery.', 50],
      [true, 'We do. I sent a quote with centerpieces, the arch and bouquets. Happy to swap anything out.', 30],
      [true, 'One question: will the tables be round or long? It changes how many arrangements you need.', 3],
    ]],
    [1, 'inquiry', [
      [false, 'Can you cover the reception and a short ceremony set?', 26],
      [true, 'Yes. Send me three songs you love and three you never want to hear, and I will build the night around them.', 2],
    ]],
    [2, 'quote', [
      [false, 'Could you do a family-style dinner with a vegetarian main?', 40],
      [true, 'Absolutely. The quote includes staff and rentals. Want to book a tasting next week?', 5],
    ]],
  ];

  const sql = `begin;
  create temporary table seed_target on commit drop as
    select u.id as uid, (
      select e.id from public.events e where e.owner_id = u.id
      order by (e.event_date >= current_date) desc nulls last, e.event_date nulls last, e.created_at desc limit 1
    ) as eid, (
      select coalesce(e.location, 'Ann Arbor, MI') from public.events e where e.owner_id = u.id
      order by (e.event_date >= current_date) desc nulls last, e.event_date nulls last, e.created_at desc limit 1
    ) as city
    from auth.users u where lower(u.email) = lower(${q(email)});
  do $$ begin
    if not exists (select 1 from seed_target) then raise exception 'No account with that email. Sign in once first.'; end if;
    if (select eid from seed_target) is null then raise exception 'That account has no events yet. Create one first.'; end if;
  end $$;

  -- Fictional vendor accounts: no password, so they cannot sign in.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ${VENDORS.map((v) => `(${q(v.user)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(v.mail)}, '', now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ name: v.name }))}, now(), now())`).join(',\n    ')}
  on conflict (id) do nothing;
  insert into public.profiles (id, display_name, roles)
  values ${VENDORS.map((v) => `(${q(v.user)}, ${q(v.name)}, '{vendor}')`).join(', ')}
  on conflict (id) do update set display_name = excluded.display_name, roles = excluded.roles;

  insert into public.vendors (id, owner_id, name, category, city, service_radius_mi, description, contact_email, verification_status, directory_listed)
  select v.id::uuid, v.owner::uuid, v.name, v.category, t.city, 30, 'Fictional sample business for trying the inbox. Not a real vendor.', v.mail, 'pending', false
  from seed_target t, (values ${VENDORS.map((v) => `(${q(v.vendor)}, ${q(v.user)}, ${q(v.name)}, ${q(v.category)}, ${q(v.mail)})`).join(', ')}) as v(id, owner, name, category, mail)
  on conflict (id) do nothing;

  insert into public.event_vendors (event_id, vendor_id, status)
  select t.eid, v.id::uuid, v.status from seed_target t,
    (values ${THREADS.map(([i, status]) => `(${q(VENDORS[i].vendor)}, ${q(status)})`).join(', ')}) as v(id, status)
  on conflict (event_id, vendor_id) do nothing;

  insert into public.messages (event_vendor_id, sender_id, body, created_at)
  select ev.id, case when m.from_vendor then v.owner_id else t.uid end, m.body, now() - make_interval(hours => m.hours)
  from seed_target t
  join public.event_vendors ev on ev.event_id = t.eid
  join public.vendors v on v.id = ev.vendor_id
  join (values ${THREADS.flatMap(([i, , msgs]) => msgs.map(([fromVendor, body, hours]) => `(${q(VENDORS[i].vendor)}, ${fromVendor}, ${q(body)}, ${hours})`)).join(',\n      ')}
  ) as m(vendor_id, from_vendor, body, hours) on m.vendor_id::uuid = v.id
  where not exists (select 1 from public.messages x where x.event_vendor_id = ev.id and x.body = m.body);

  insert into public.quotes (event_vendor_id, amount_cents, description, valid_until, status, created_at)
  select ev.id, q.cents, q.description, current_date + 30, 'sent', now() - interval '1 day'
  from seed_target t join public.event_vendors ev on ev.event_id = t.eid
  join (values (${q(VENDORS[0].vendor)}, 280000, 'Sample quote: centerpieces, ceremony arch and bouquets.'),
               (${q(VENDORS[2].vendor)}, 940000, 'Sample quote: family-style dinner with a vegetarian main, staff and rentals.')) as q(vendor_id, cents, description)
    on q.vendor_id::uuid = ev.vendor_id
  where not exists (select 1 from public.quotes x where x.event_vendor_id = ev.id);
  commit;
  select json_build_object('event', (select title from public.events where id = (select eid from seed_target)),
    'threads', (select count(*) from public.event_vendors where vendor_id in (${ids('vendor')}) and event_id = (select eid from seed_target))) as result
  from (select 1) x;`;
  // seed_target is dropped at commit, so read the result in its own statement.
  const sqlNoResult = sql.slice(0, sql.lastIndexOf('select json_build_object'));
  query(sqlNoResult);
  const rows = query(`select json_build_object('event', e.title, 'threads', count(ev.id)) from public.events e
    join auth.users u on u.id = e.owner_id and lower(u.email) = lower(${q(email)})
    join public.event_vendors ev on ev.event_id = e.id and ev.vendor_id in (${ids('vendor')})
    group by e.title;`);
  console.log('Added sample vendor conversations:', JSON.stringify(rows));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
