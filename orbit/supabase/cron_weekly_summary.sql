-- Weekly Summary Cron Job
-- Run this in Supabase SQL Editor to schedule weekly AI summary emails
-- Schedule: Every Sunday at 6pm UTC

-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
-- Find it at: https://supabase.com/dashboard/project/aeuvwynwyrlrtgkrujts/settings/api

SELECT cron.schedule(
  'weekly-summary-sunday-6pm',
  '0 18 * * 0',  -- Every Sunday at 6pm UTC
  $$
  SELECT net.http_post(
    url := 'https://aeuvwynwyrlrtgkrujts.supabase.co/functions/v1/send-weekly-summary',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job was created:
-- SELECT * FROM cron.job WHERE jobname LIKE '%weekly%';

-- To test immediately (sends to all users with email reminders):
-- SELECT net.http_post(
--   url := 'https://aeuvwynwyrlrtgkrujts.supabase.co/functions/v1/send-weekly-summary',
--   headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--   body := '{"test": true}'::jsonb
-- );
