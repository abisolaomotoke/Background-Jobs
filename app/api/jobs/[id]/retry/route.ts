import { NextResponse } from 'next/server';
import { pool } from '@/db';

export async function POST(
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
      `UPDATE jobs
       SET status = 'pending', attempts = 0, runAt = NOW()
       WHERE id = $1 AND status = 'dead'
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Dead job not found' }, { status: 404 });
    }

    return NextResponse.json({ id: result.rows[0].id, status: 'pending' });
  } catch {
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
