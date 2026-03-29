-- 009_fix_cron_auth_key.sql
-- Fix ALL cron jobs: replace sb_publishable_* key (rejected by Edge Functions
-- gateway with 401 "Invalid Token or Protected Header formatting") with the legacy
-- JWT anon key that the gateway accepts.

-- Drop existing jobs safely
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-trendwatcher-report' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;

  select jobid into jid from cron.job where jobname = 'weekly-trendwatcher-report' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;

  select jobid into jid from cron.job where jobname = 'monthly-trendwatcher-report' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

-- Daily: every day at 09:00 UTC
select cron.schedule(
  'daily-trendwatcher-report',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/daily-report'::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oYml5cWViY3ZlcWpveHhueXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI1MTQsImV4cCI6MjA4NzYxODUxNH0.TM8nKhbYg7unO1R5Yjn7-_zKZO9InWBdKJoE3QwYOXw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Weekly: every Monday at 08:00 UTC
select cron.schedule(
  'weekly-trendwatcher-report',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := 'https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/weekly-report'::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oYml5cWViY3ZlcWpveHhueXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI1MTQsImV4cCI6MjA4NzYxODUxNH0.TM8nKhbYg7unO1R5Yjn7-_zKZO9InWBdKJoE3QwYOXw"}'::jsonb,
    body := '{"period_type":"week"}'::jsonb
  );
  $$
);

-- Monthly: 1st of each month at 09:00 UTC
select cron.schedule(
  'monthly-trendwatcher-report',
  '0 9 1 * *',
  $$
  select net.http_post(
    url := 'https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/weekly-report'::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oYml5cWViY3ZlcWpveHhueXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI1MTQsImV4cCI6MjA4NzYxODUxNH0.TM8nKhbYg7unO1R5Yjn7-_zKZO9InWBdKJoE3QwYOXw"}'::jsonb,
    body := '{"period_type":"month"}'::jsonb
  );
  $$
);
