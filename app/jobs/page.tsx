'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Job = {
  id: number;
  status: string;
  attempts: number;
  lastError: string | null;
};

export default function JobsPage() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?limit=25', { cache: 'no-store' });
      const data = await res.json();
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to,
        subject,
        body,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setNotice(`Enqueued job #${data.id}`);
      setTo('');
      setSubject('');
      setBody('');
      load();
    } else {
      setNotice(data.error ?? 'Failed to enqueue');
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6 font-sans">
      <h1 className="mb-4 text-2xl font-semibold">Enqueue email job</h1>
      <form onSubmit={onSubmit} className="mb-8 flex flex-col gap-3">
        <input
          className="rounded border border-zinc-300 px-3 py-2"
          placeholder="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2"
          placeholder="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
        <textarea
          className="rounded border border-zinc-300 px-3 py-2"
          placeholder="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <button
          className="self-start rounded bg-black px-4 py-2 text-white"
          type="submit"
        >
          Enqueue
        </button>
        {notice ? <p className="text-sm text-zinc-600">{notice}</p> : null}
      </form>

      <h2 className="mb-2 text-xl font-semibold">Recent jobs</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            <th className="border-b p-2">id</th>
            <th className="border-b p-2">status</th>
            <th className="border-b p-2">attempts</th>
            <th className="border-b p-2">lastError</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="border-b p-2">{job.id}</td>
              <td className="border-b p-2">{job.status}</td>
              <td className="border-b p-2">{job.attempts}</td>
              <td className="border-b p-2 break-all">{job.lastError ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
