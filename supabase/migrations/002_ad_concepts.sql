-- Add ad_concepts field to reports for storing creative concepts for ads

alter table public.reports
  add column if not exists ad_concepts jsonb default '[]'::jsonb;

