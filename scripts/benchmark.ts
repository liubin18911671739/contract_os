/**
 * Performance benchmark script
 * Usage: npx tsx scripts/benchmark.ts
 */
import { sql } from '../server/src/config/db.js';
import { modelGateway } from '../server/src/llm/modelGateway.js';
import { logger } from '../server/src/config/logger.js';

async function measureDBPerformance() {
  console.log('\n=== Database Performance ===');

  // Test simple query
  const start = Date.now();
  await sql`SELECT 1`;
  const pingTime = Date.now() - start;

  console.log(`PING: ${pingTime}ms`);

  // Test task creation
  const taskStart = Date.now();
  await sql`
    INSERT INTO precheck_tasks (id, contract_version_id, status, progress, current_stage, config_snapshot_id, kb_mode)
    VALUES ('bench_task', 'bench_ver', 'QUEUED', 0, 'QUEUED', 'snap1', 'STRICT')
    ON CONFLICT (id) DO NOTHING
  `;
  const insertTime = Date.now() - taskStart;

  console.log(`TASK INSERT: ${insertTime}ms`);

  // Test task query
  const queryStart = Date.now();
  await sql`SELECT * FROM precheck_tasks WHERE id = 'bench_task'`;
  const queryTime = Date.now() - queryStart;

  console.log(`TASK QUERY: ${queryTime}ms`);

  // Cleanup
  await sql`DELETE FROM precheck_tasks WHERE id = 'bench_task'`;
}

async function measureLLMPerformance() {
  console.log('\n=== LLM Performance ===');

  const testQuery = 'What is the capital of France?';

  // Test embedding
  const embedStart = Date.now();
  try {
    await modelGateway.embed([testQuery]);
    const embedTime = Date.now() - embedStart;
    console.log(`EMBEDDING (1 text): ${embedTime}ms`);
  } catch (error) {
    console.log(`EMBEDDING: Failed - ${error}`);
  }

  // Test chat
  const chatStart = Date.now();
  try {
    await modelGateway.chat(
      [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello"' },
      ],
      { temperature: 0.7, maxTokens: 10 }
    );
    const chatTime = Date.now() - chatStart;
    console.log(`CHAT COMPLETION (short): ${chatTime}ms`);
  } catch (error) {
    console.log(`CHAT: Failed - ${error}`);
  }
}

async function measureMemoryUsage() {
  console.log('\n=== Memory Usage ===');

  if (process.memoryUsage) {
    const mem = process.memoryUsage();
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

    console.log(`RSS: ${mb(mem.rss)} MB`);
    console.log(`Heap Total: ${mb(mem.heapTotal)} MB`);
    console.log(`Heap Used: ${mb(mem.heapUsed)} MB`);
    console.log(`External: ${mb(mem.external)} MB`);
  }
}

async function main() {
  console.log('=== Contract Pre-check System - Performance Benchmark ===\n');

  await measureMemoryUsage();
  await measureDBPerformance();
  await measureLLMPerformance();

  console.log('\n=== Benchmark Complete ===');
  process.exit(0);
}

main();
