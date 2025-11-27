import { app } from './server';
import { env } from './config/env';
import { connectDb } from './db/client';

async function bootstrap(): Promise<void> {
  await connectDb();
  app.listen(env.port, () => {
    console.log(JSON.stringify({ level: 'info', message: `API listening on port ${env.port}` }));
  });
}

bootstrap().catch((err) => {
  console.error(JSON.stringify({ level: 'error', message: 'Failed to start server', error: err }));
  process.exit(1);
});
