export const config = {
  maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS) || 10,
  backoffBase: Number(process.env.JOB_BACKOFF_BASE) || 1000, // ms
  jitterMs: Number(process.env.JOB_JITTER_MS) || 250, // ms
  workerConcurrency: Number(process.env.JOB_CONCURRENCY) || 1,
  stuckTimeoutMs: Number(process.env.JOB_STUCK_TIMEOUT_MS) || 30000, // 30s
  pollIntervalMs: Number(process.env.JOB_POLL_INTERVAL_MS) || 500, // ms
  emailForceFail: process.env.EMAIL_FORCE_FAIL === 'true',
  emailDelayMs: Number(process.env.EMAIL_DELAY_MS) || 0,
};
