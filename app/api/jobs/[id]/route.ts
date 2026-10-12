import { NextResponse } from 'next/server';
import { pool } from '@/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT status, attempts, lastError AS "lastError" FROM jobs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = result.rows[0];
    return NextResponse.json({
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError || null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}