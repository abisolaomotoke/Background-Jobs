const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  for (let i = 1; i <= 50; i++) {
    const idempotencyKey = `bulk-${Date.now()}-${i}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: `user${i}@example.com`,
        subject: `Bulk job ${i}`,
        body: `Body for bulk job ${i}`,
        idempotencyKey,
      }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`${i}\t${res.status}\t${data.id ?? data.error ?? ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
