-- 007_aggregate_sections.sql
-- Add structured sections for weekly/monthly reports:
-- growing_trends, pain_points, product_hypotheses (jsonb arrays).

alter table public.aggregate_reports
  add column if not exists growing_trends jsonb not null default '[]'::jsonb,
  add column if not exists pain_points jsonb not null default '[]'::jsonb,
  add column if not exists product_hypotheses jsonb not null default '[]'::jsonb;

