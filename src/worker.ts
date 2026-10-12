import { pool } from './db';
import { config } from './config';
import { sendEmail } from './email';

type JobStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'dead';

interface JobRow {
  id: number;
  type: string;
  payload: { to?: string; subject?: string; body?: string };
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  idempotencyKey: string;
}

const MAX_BACKOFF_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function computeBackoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const backoff = Math.min(config.backoffBase * 2 ** exponent, MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * (config.jitterMs + 1));
  return backoff + jitter;
}

async function claimJobs(limit: number): Promise<JobRow[]> {
  const result = await pool.query<JobRow>(
    `WITH claimed AS (
       SELECT id FROM jobs
       WHERE status IN ('pending', 'failed') AND runAt <= NOW()
       ORDER BY runAt ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE jobs AS j
     SET status = 'processing',
         attempts = j.attempts + 1,
         startedAt = NOW()
     FROM claimed
     WHERE j.id = claimed.id
     RETURNING j.id, j.type, j.payload, j.status, j.attempts,
               j.maxAttempts AS "maxAttempts",
               j.lastError AS "lastError",
               j.runAt AS "runAt",
               j.startedAt AS "startedAt",
               j.finishedAt AS "finishedAt",
               j.idempotencyKey AS "idempotencyKey"`,
    [limit]
  );
  return result.rows;
}

async function sweepStuckJobs(): Promise<number> {
  const result = await pool.query(
    `UPDATE jobs
     SET status = CASE
           WHEN attempts >= maxAttempts THEN 'dead'
           ELSE 'pending'
         END,
         runAt = NOW(),
         finishedAt = CASE
           WHEN attempts >= maxAttempts THEN NOW()
           ELSE finishedAt
         END,
         lastError = 'Recovered from stuck processing state (timeout)'
     WHERE status = 'processing'
       AND startedAt IS NOT NULL
       AND startedAt < NOW() - ($1::bigint * INTERVAL '1 millisecond')`,
    [config.stuckTimeoutMs]
  );
  return result.rowCount ?? 0;
}

async function markSucceeded(id: number): Promise<void> {
  await pool.query(
    `UPDATE jobs
     SET status = 'succeeded', finishedAt = NOW(), lastError = NULL
     WHERE id = $1`,
    [id]
  );
}

async function markFailed(job: JobRow, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  if (job.attempts >= job.maxAttempts) {
    await pool.query(
      `UPDATE jobs
       SET status = 'dead', finishedAt = NOW(), lastError = $2
       WHERE id = $1`,
      [job.id, message]
    );
    console.log(
      `[${new Date().toISOString()}] job ${job.id} DEAD after ${job.attempts}/${job.maxAttempts} attempts: ${message}`
    );
    return;
  }

  const delay = computeBackoffMs(job.attempts);
  const now = new Date();
  const nextRunAt = new Date(now.getTime() + delay);
  await pool.query(
    `UPDATE jobs
     SET status = 'failed',
         runAt = NOW() + ($2::bigint * INTERVAL '1 millisecond'),
         lastError = $3
     WHERE id = $1`,
    [job.id, delay, message]
  );
  console.log(
    `[${now.toISOString()}] job ${job.id} failed attempt ${job.attempts}/${job.maxAttempts}, retry in ${delay}ms at ${nextRunAt.toISOString()}`
  );
}

let activeJobs = 0;

async function processJob(job: JobRow): Promise<void> {
  activeJobs += 1;
  console.log(`concurrent: ${activeJobs}/${config.workerConcurrency}`);
  try {
    if (job.type !== 'send_email') {
      throw new Error(`Unsupported job type: ${job.type}`);
    }

    const { to, subject, body } = job.payload;
    if (!to || !subject || !body) {
      throw new Error('Invalid send_email payload');
    }

    const alreadySent = await pool.query(
      'SELECT 1 FROM sent_emails WHERE job_id = $1',
      [job.id]
    );
    if (alreadySent.rowCount && alreadySent.rowCount > 0) {
      console.log(`[worker] job ${job.id} already sent (sent_emails row exists), skipping send`);
      await markSucceeded(job.id);
      return;
    }

    if (config.emailForceFail) {
      throw new Error('EMAIL_FORCE_FAIL is enabled');
    }

    if (config.emailDelayMs > 0) {
      await sleep(config.emailDelayMs);
    }

    await sendEmail({ to, subject, body });

    await pool.query(
      `INSERT INTO sent_emails (job_id, to_email, subject, body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_id) DO NOTHING`,
      [job.id, to, subject, body]
    );

    await markSucceeded(job.id);
  } catch (error) {
    console.error(`[worker] job ${job.id} failed:`, error);
    await markFailed(job, error);
  } finally {
    activeJobs -= 1;
  }
}

export async function runOnce(): Promise<number> {
  const recovered = await sweepStuckJobs();
  if (recovered > 0) {
    console.warn(`[worker] recovered ${recovered} stuck job(s)`);
  }

  const capacity = config.workerConcurrency - activeJobs;
  if (capacity <= 0) {
    return 0;
  }

  const jobs = await claimJobs(capacity);
  if (jobs.length === 0) {
    return 0;
  }

  await Promise.all(jobs.map((job) => processJob(job)));
  return jobs.length;
}

let running = false;

export async function startWorker(): Promise<void> {
  if (running) return;
  running = true;

  console.log('[worker] started', {
    workerConcurrency: config.workerConcurrency,
    pollIntervalMs: config.pollIntervalMs,
    stuckTimeoutMs: config.stuckTimeoutMs,
    emailForceFail: config.emailForceFail,
  });

  const shutdown = () => {
    running = false;
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      const processed = await runOnce();
      if (processed > 0) {
        continue;
      }
    } catch (error) {
      console.error('[worker] loop error:', error);
    }

    await sleep(config.pollIntervalMs);
  }

  console.log('[worker] stopped');
  await pool.end();
}
