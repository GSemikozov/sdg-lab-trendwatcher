-- 006_weekly_monthly_cron.sql
-- Schedule automated weekly and monthly aggregate report generation.
-- Uses pg_cron + pg_net to call the weekly-report Edge Function.
-- Auth uses anon key in headers (same pattern as daily-report cron).

-- Weekly: every Monday at 08:00 UTC
select cron.schedule(
  'weekly-trendwatcher-report',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := 'https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/weekly-report'::text,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_XLxkKH8UT_uhjfsPQml2-w_bBX7KQJ"}'::jsonb,
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
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_XLxkKH8UT_uhjfsPQml2-w_bBX7KQJ"}'::jsonb,
    body := '{"period_type":"month"}'::jsonb
  );
  $$
);
