-- 011_disable_all_cron_jobs.sql
-- Service on hold: disable all scheduled report generation to stop OpenAI costs.

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
