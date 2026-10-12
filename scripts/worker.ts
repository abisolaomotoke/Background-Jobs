import { startWorker } from '../src/worker';

startWorker().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
