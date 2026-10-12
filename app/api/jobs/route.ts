import { NextResponse } from 'next/server';
import { pool } from '@/db';
import { config } from '@/config';

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const status = searchParams.get('status');
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1),
      200
    );

    const params: (string | number)[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT id, type, payload, status, attempts,
              lastError AS "lastError",
              runAt AS "runAt", startedAt AS "startedAt", finishedAt AS "finishedAt"
       FROM jobs
       ${where}
       ORDER BY id DESC
       LIMIT $${params.length}`,
      params
    );

    return NextResponse.json({ jobs: result.rows });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { to, subject, body: emailBody, idempotencyKey } = body;

    if (!to || !subject || !emailBody || !idempotencyKey) {
      return NextResponse.json(
        { error: 'to, subject, body, idempotencyKey are required' },
        { status: 400 }
      );
    }

    const payload = {
      to,
      subject,
      body: emailBody,
    };

    const sql = `INSERT INTO jobs (type, payload, status, maxAttempts, idempotencyKey, runAt)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (idempotencyKey) DO NOTHING
      RETURNING id`;
    const values = ['send_email', payload, 'pending', config.maxAttempts, idempotencyKey];

    const result = await pool.query(sql, values);
    if (result.rows.length > 0) {
      return NextResponse.json({ id: result.rows[0].id }, { status: 202 });
    }

    const existing = await pool.query(
      'SELECT id FROM jobs WHERE idempotencyKey = $1',
      [idempotencyKey]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ id: existing.rows[0].id }, { status: 202 });
    }

    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 });
  } catch {
    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 });
  }
}








