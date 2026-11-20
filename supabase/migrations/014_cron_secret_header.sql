-- 014_cron_secret_header.sql
-- daily-report all-spaces (cron) requires header x-cron-secret matching Edge CRON_SECRET.
-- The secret is NOT stored in git: read it at schedule time from Supabase Vault.
--
-- One-time operator setup (SQL editor), value must match Edge secret CRON_SECRET:
--   select vault.create_secret(
--     '<CRON_SECRET value>',
--     'daily_report_cron_secret',
--     'pg_cron → Edge daily-report x-cron-secret'
--   );
-- If the name already exists, update via vault.update_secret(id, new_secret) instead.
--
-- Manual UI calls continue to use anon/user JWT + space_id (no vault secret needed).

do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'daily-trendwatcher-report' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

-- Daily: every day at 09:00 UTC — Authorization stays legacy anon JWT for gateway;
-- x-cron-secret comes from vault at execution time (empty if vault row missing → 403).
select cron.schedule(
  'daily-trendwatcher-report',
  '0 9 * * *',
  $cmd$
  select net.http_post(
    url := 'https://nhbiyqebcveqjoxxnytm.supabase.co/functions/v1/daily-report'::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oYml5cWViY3ZlcWpveHhueXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDI1MTQsImV4cCI6MjA4NzYxODUxNH0.TM8nKhbYg7unO1R5Yjn7-_zKZO9InWBdKJoE3QwYOXw',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'daily_report_cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
