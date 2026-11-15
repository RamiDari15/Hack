-- Shortlist and compare, the event package, and shared planning (comments, votes, tasks).
-- Everyone on the event (owner and cohosts) can shortlist, comment, vote and work on tasks.
-- Package choices and quote decisions stay with the owner.

-- Names of the people on an event, for viewers of that event only (profiles stay private otherwise).
create or replace function public.event_people(e uuid)
returns table (user_id uuid, display_name text, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, 'Member'), p.id = ev.owner_id
  from public.events ev
  join public.profiles p on p.id = ev.owner_id or p.id in (select m.user_id from public.event_members m where m.event_id = ev.id)
  where ev.id = e and public.can_view_event(e)
  order by 3 desc, 2;
$$;
revoke execute on function public.event_people(uuid) from public;
grant execute on function public.event_people(uuid) to authenticated;

create table if not exists public.event_shortlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  in_package boolean not null default false,
  planned_cents int check (planned_cents is null or planned_cents between 0 and 100000000),
  created_at timestamptz not null default now(),
  unique (event_id, vendor_id)
);
create index if not exists shortlist_event_idx on public.event_shortlist (event_id);
alter table public.event_shortlist enable row level security;
create policy "shortlist: viewers read" on public.event_shortlist for select using (public.can_view_event(event_id));
create policy "shortlist: viewers add" on public.event_shortlist for insert
  with check (public.can_view_event(event_id) and added_by = auth.uid() and in_package = false and planned_cents is null);
create policy "shortlist: owner updates" on public.event_shortlist for update using (public.owns_event(event_id)) with check (public.owns_event(event_id));
create policy "shortlist: owner or adder removes" on public.event_shortlist for delete using (public.owns_event(event_id) or added_by = auth.uid());

-- One package pick per category: picking a vendor clears the other picks in its category.
create or replace function public.one_package_pick_per_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.in_package and (tg_op = 'INSERT' or not old.in_package) then
    update public.event_shortlist s set in_package = false
    from public.vendors v, public.vendors mine
    where s.event_id = new.event_id and s.id <> new.id and s.in_package
      and v.id = s.vendor_id and mine.id = new.vendor_id and v.category = mine.category;
  end if;
  return new;
end;
$$;
drop trigger if exists shortlist_one_pick on public.event_shortlist;
create trigger shortlist_one_pick after insert or update of in_package on public.event_shortlist
  for each row execute function public.one_package_pick_per_category();

create table if not exists public.shortlist_votes (
  shortlist_id uuid not null references public.event_shortlist(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (shortlist_id, user_id)
);
alter table public.shortlist_votes enable row level security;
create or replace function public.shortlist_event(s uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select event_id from public.event_shortlist where id = s;
$$;
create policy "votes: viewers read" on public.shortlist_votes for select using (public.can_view_event(public.shortlist_event(shortlist_id)));
create policy "votes: own insert" on public.shortlist_votes for insert with check (user_id = auth.uid() and public.can_view_event(public.shortlist_event(shortlist_id)));
create policy "votes: own update" on public.shortlist_votes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes: own delete" on public.shortlist_votes for delete using (user_id = auth.uid());

create table if not exists public.shortlist_comments (
  id uuid primary key default gen_random_uuid(),
  shortlist_id uuid not null references public.event_shortlist(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists shortlist_comments_idx on public.shortlist_comments (shortlist_id, created_at);
alter table public.shortlist_comments enable row level security;
create policy "comments: viewers read" on public.shortlist_comments for select using (public.can_view_event(public.shortlist_event(shortlist_id)));
create policy "comments: viewers write own" on public.shortlist_comments for insert with check (user_id = auth.uid() and public.can_view_event(public.shortlist_event(shortlist_id)));
create policy "comments: author deletes" on public.shortlist_comments for delete using (user_id = auth.uid());

-- Shared checklist: anyone on the event can add, assign and tick tasks.
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_note text check (char_length(due_note) <= 80),
  assignee_id uuid references public.profiles(id) on delete set null,
  done boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  source text not null default 'organizer' check (source in ('organizer', 'ai')),
  created_at timestamptz not null default now()
);
create index if not exists event_tasks_idx on public.event_tasks (event_id, done, created_at);
alter table public.event_tasks enable row level security;
-- Assignee must be someone on the event.
create or replace function public.is_event_person(e uuid, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select u is null or exists (select 1 from public.events where id = e and owner_id = u)
      or exists (select 1 from public.event_members where event_id = e and user_id = u);
$$;
create policy "tasks: viewers read" on public.event_tasks for select using (public.can_view_event(event_id));
create policy "tasks: viewers add" on public.event_tasks for insert
  with check (public.can_view_event(event_id) and created_by = auth.uid() and public.is_event_person(event_id, assignee_id));
create policy "tasks: viewers update" on public.event_tasks for update
  using (public.can_view_event(event_id)) with check (public.can_view_event(event_id) and public.is_event_person(event_id, assignee_id));
create policy "tasks: owner or creator deletes" on public.event_tasks for delete using (public.owns_event(event_id) or created_by = auth.uid());
revoke update on public.event_tasks from authenticated;
grant update (title, due_note, assignee_id, done) on public.event_tasks to authenticated;

-- Style boards: inspiration photos by section. Uploads are resized in the browser and kept in
-- Postgres (small JPEG/PNG/WebP data URLs) so they follow the same row-level security as the event.
create table if not exists public.style_board_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  section text not null check (section in ('venue', 'flowers', 'decor', 'outfits', 'other')),
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2000)),
  image_data text check (image_data is null or (image_data ~ '^data:image/(jpeg|png|webp);base64,' and char_length(image_data) <= 700000)),
  caption text check (char_length(caption) <= 200),
  added_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((image_url is null) <> (image_data is null))
);
create index if not exists style_board_event_idx on public.style_board_items (event_id, section, created_at);
alter table public.style_board_items enable row level security;
create policy "board: viewers read" on public.style_board_items for select using (public.can_view_event(event_id));
create policy "board: viewers add" on public.style_board_items for insert with check (public.can_view_event(event_id) and added_by = auth.uid());
create policy "board: owner or adder removes" on public.style_board_items for delete using (public.owns_event(event_id) or added_by = auth.uid());
