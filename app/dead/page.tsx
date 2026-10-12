'use client';

import { useCallback, useEffect, useState } from 'react';

type Job = {
  id: number;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  lastError: string | null;
  finishedAt: string | null;
};

export default function DeadPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?status=dead', { cache: 'no-store' });
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: number) {
    setNotice(null);
    const res = await fetch(`/api/jobs/${id}/retry`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setNotice(res.ok ? `Job #${id} requeued` : data.error ?? 'Retry failed');
    load();
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6 font-sans">
      <h1 className="mb-4 text-2xl font-semibold">Dead letter queue</h1>
      {notice ? <p className="mb-3 text-sm text-zinc-600">{notice}</p> : null}
      {jobs.length === 0 ? <p className="text-zinc-600">No dead jobs.</p> : null}
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id} className="rounded border border-zinc-300 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">#{job.id}</span>
              <button
                className="rounded bg-black px-3 py-1 text-white"
                onClick={() => retry(job.id)}
                type="button"
              >
                Retry
              </button>
            </div>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1">
              <dt className="text-zinc-500">payload</dt>
              <dd className="break-all font-mono">{JSON.stringify(job.payload)}</dd>
              <dt className="text-zinc-500">lastError</dt>
              <dd className="break-all">{job.lastError ?? ''}</dd>
              <dt className="text-zinc-500">attempts</dt>
              <dd>{job.attempts}</dd>
              <dt className="text-zinc-500">finishedAt</dt>
              <dd>{job.finishedAt ?? ''}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}
