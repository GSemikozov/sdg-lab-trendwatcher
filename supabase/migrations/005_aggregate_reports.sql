-- 005_aggregate_reports.sql
-- Unified table for weekly and monthly aggregate reports per space.
-- Does NOT affect existing daily reports table.

create table if not exists public.aggregate_reports (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  summary text not null default '',
  creative_concepts jsonb not null default '[]'::jsonb,
  cluster_summaries jsonb not null default '[]'::jsonb,
  total_posts integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists aggregate_reports_space_period_unique
  on public.aggregate_reports (space_id, period_type, period_start);

create index if not exists aggregate_reports_space_period_idx
  on public.aggregate_reports (space_id, period_type, period_start desc);

alter table public.aggregate_reports enable row level security;
create policy "Allow all on aggregate_reports" on public.aggregate_reports for all using (true);
