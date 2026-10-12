import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/db';

async function main() {
  const schemaPath = join(__dirname, '..', 'sql', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Migration complete');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
