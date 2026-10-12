import { Pool, type QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({
  connectionString,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
) {
  const result = await pool.query<T>(text, params);
  return result;
}
