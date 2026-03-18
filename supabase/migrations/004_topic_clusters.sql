-- 004_topic_clusters.sql
-- Table for storing weekly/monthly topic clusters per space.
-- Purely additive, does not affect existing reports.

create table if not exists public.topic_clusters (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null,
  cluster_index integer not null,
  centroid vector(1536) not null,
  size integer not null,
  top_post_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists topic_clusters_space_period_cluster_unique
  on public.topic_clusters (space_id, period_type, period_start, cluster_index);

create index if not exists topic_clusters_space_period_idx
  on public.topic_clusters (space_id, period_type, period_start desc);

