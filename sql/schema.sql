-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','succeeded','failed','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  maxAttempts INTEGER NOT NULL DEFAULT 10,
  lastError TEXT,
  runAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  startedAt TIMESTAMPTZ,
  finishedAt TIMESTAMPTZ,
  idempotencyKey TEXT NOT NULL UNIQUE
);

-- Indexes to support worker claim and stuck-job sweep
CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs (status, runAt) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_jobs_processing ON jobs (status, startedAt) WHERE status = 'processing';

-- Sent emails table for idempotent work
CREATE TABLE IF NOT EXISTS sent_emails (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sentAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
