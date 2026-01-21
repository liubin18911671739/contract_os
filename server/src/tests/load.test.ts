/**
 * Performance / Load Testing
 *
 * This file contains performance benchmarks and load testing scenarios.
 * Run with: npm run test:load
 */
import { describe } from 'node:test';
import assert from 'node:assert';

// Simple performance benchmarks
describe('Performance Benchmarks', () => {
  it('should hash input quickly', async () => {
    const { sha256 } = await import('../utils/hash.js');

    const iterations = 1000;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      sha256('test input data for hashing');
    }

    const elapsed = Date.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`SHA256 hash: ${avgTime.toFixed(3)}ms per operation (${iterations} ops in ${elapsed}ms)`);

    // Should be very fast (< 1ms per operation)
    assert.ok(avgTime < 1, 'Hashing should be fast');
  });

  it('should generate IDs quickly', async () => {
    const { generateId } = await import('../utils/hash.js');

    const iterations = 10000;
    const start = Date.now();

    const ids = [];
    for (let i = 0; i < iterations; i++) {
      ids.push(generateId('test'));
    }

    const elapsed = Date.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`ID generation: ${avgTime.toFixed(3)}ms per operation (${iterations} ops in ${elapsed}ms)`);

    assert.ok(avgTime < 0.1, 'ID generation should be very fast');
    assert.strictEqual(ids.length, iterations);
    assert.ok(new Set(ids).size === iterations, 'All IDs should be unique');
  });

  it('should paginate quickly', async () => {
    const { buildPaginationResult } = await import('../utils/pagination.js');

    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    const start = Date.now();
    const result = buildPaginationResult(data, 1, 10, 100);
    const elapsed = Date.now() - start;

    console.log(`Pagination: ${elapsed}ms for 100 items`);

    assert.strictEqual(result.data.length, 10);
    assert.strictEqual(result.totalPages, 10);
    assert.ok(elapsed < 10, 'Pagination should be fast');
  });
});

describe('Load Testing Scenarios', () => {
  it('should handle large text processing', async () => {
    const { truncateText } = await import('../utils/promptGuard.js');

    const largeText = 'A'.repeat(1000000); // 1MB text
    const iterations = 100;

    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      truncateText(largeText, 1000);
    }

    const elapsed = Date.now() - start;
    const avgTime = elapsed / iterations;

    console.log(`Text truncation: ${avgTime.toFixed(3)}ms per operation (${iterations} ops in ${elapsed}ms)`);

    assert.ok(avgTime < 1, 'Text truncation should be fast');
  });

  it('should measure database query performance target', async () => {
    // This is a benchmark target, not actual test
    const targets = {
      taskCreation: '< 100ms',
      taskQuery: '< 50ms',
      kbSearch: '< 200ms',
      reportGeneration: '< 5000ms',
    };

    console.log('\nPerformance Targets:');
    console.table(targets);

    // Verify targets are defined
    assert.ok(Object.keys(targets).length > 0);
  });
});

// Memory usage tracking
describe('Memory Profiling', () => {
  it('should log memory usage', async () => {
    if (process.memoryUsage) {
      const mem = process.memoryUsage();
      const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

      console.log('\nMemory Usage:');
      console.log(`  RSS: ${mb(mem.rss)} MB`);
      console.log(`  Heap Total: ${mb(mem.heapTotal)} MB`);
      console.log(`  Heap Used: ${mb(mem.heapUsed)} MB`);
      console.log(`  External: ${mb(mem.external)} MB`);
    }

    assert.ok(true);
  });
});
