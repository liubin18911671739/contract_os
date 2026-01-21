/**
 * Database migration runner
 */
import { sql } from '../config/db.js';
import { logger } from '../config/logger.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function runMigrations() {
  logger.info('Running database migrations...');

  try {
    // Create migrations tracking table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Read all migration files
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const executed = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`;
    const executedSet = new Set(executed.map((e) => e.name));

    // Run pending migrations
    for (const file of files) {
      if (executedSet.has(file)) {
        logger.debug({ migration: file }, 'Already executed, skipping');
        continue;
      }

      logger.info({ migration: file }, 'Running migration');
      const content = readFileSync(join(migrationsDir, file), 'utf-8');

      // Split by semicolon and run each statement
      const statements = content
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await sql.unsafe(statement);
      }

      await sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
      logger.info({ migration: file }, 'Migration completed');
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    throw error;
  } finally {
    await sql.end();
  }
}

runMigrations();
