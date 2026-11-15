-- Saved external results: a web discovery (Exa) result the event owner saved to an event.
-- Kept apart from verified vendors on purpose. Nothing here is verified by Vendora.
create table if not exists public.event_saved_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  host text,
  snippet text check (char_length(snippet) <= 600),
  source text not null default 'exa' check (source in ('exa')),
  created_at timestamptz not null default now(),
  unique (event_id, url)
);
create index if not exists event_saved_results_event_idx on public.event_saved_results (event_id, created_at desc);

alter table public.event_saved_results enable row level security;
create policy "saved results: owner all" on public.event_saved_results for all
  using (public.owns_event(event_id)) with check (public.owns_event(event_id));
