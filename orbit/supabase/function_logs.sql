-- Function Invocation Logs Table
-- Run this in Supabase SQL Editor to create a logs table

CREATE TABLE IF NOT EXISTS function_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  invoked_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT, -- 'started', 'success', 'error'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_function_logs_name_time
ON function_logs(function_name, invoked_at DESC);

-- Allow service role to insert logs
ALTER TABLE function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage logs" ON function_logs
  FOR ALL USING (true);

-- Query recent logs:
-- SELECT * FROM function_logs ORDER BY invoked_at DESC LIMIT 50;

-- Query by function:
-- SELECT * FROM function_logs WHERE function_name = 'send-reminders' ORDER BY invoked_at DESC;

-- Query today's logs:
-- SELECT * FROM function_logs WHERE invoked_at > NOW() - INTERVAL '24 hours' ORDER BY invoked_at DESC;
