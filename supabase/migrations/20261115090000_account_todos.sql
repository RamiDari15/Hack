-- Personal to-do list on the account page. Private to its owner; optionally linked to one of
-- the owner's (or a shared) events, which the owner must be able to see.
create table if not exists public.user_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  event_id uuid references public.events(id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_todos_idx on public.user_todos (user_id, done, due_date);
alter table public.user_todos enable row level security;
create policy "todos: own read" on public.user_todos for select using (user_id = auth.uid());
create policy "todos: own insert" on public.user_todos for insert
  with check (user_id = auth.uid() and (event_id is null or public.can_view_event(event_id)));
create policy "todos: own update" on public.user_todos for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and (event_id is null or public.can_view_event(event_id)));
create policy "todos: own delete" on public.user_todos for delete using (user_id = auth.uid());
revoke update on public.user_todos from authenticated;
grant update (title, due_date, event_id, done) on public.user_todos to authenticated;
revoke all on public.user_todos from anon;

-- Stamp when an item is finished.
create or replace function public.stamp_todo_done() returns trigger language plpgsql set search_path = public as $$
begin
  new.done_at := case when new.done then coalesce(old.done_at, now()) else null end;
  return new;
end $$;
drop trigger if exists stamp_todo_done on public.user_todos;
create trigger stamp_todo_done before insert or update of done on public.user_todos
  for each row execute function public.stamp_todo_done();
