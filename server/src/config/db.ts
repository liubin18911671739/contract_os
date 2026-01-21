/**
 * Database connection
 */
import postgres from 'postgres';
import { env } from './env.js';
import { logger } from './logger.js';

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: (notice) => logger.debug({ notice }, 'Database notice'),
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await sql.end();
}
