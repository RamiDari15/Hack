-- "Help me choose" in the vendor walkthrough logs its AI requests like the planner and web search.
alter table public.ai_requests drop constraint if exists ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check (kind in ('plan', 'discover', 'sponsor', 'advice'));
