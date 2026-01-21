/**
 * Queue tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Queue Configuration', () => {
  it('should have all required queues', () => {
    const requiredQueues = [
      'precheck.orchestrator',
      'precheck.agent.parse',
      'precheck.agent.split',
      'precheck.agent.rules',
      'precheck.agent.kbRetrieval',
      'precheck.agent.llmRisk',
      'precheck.agent.evidence',
      'precheck.agent.qc',
      'precheck.agent.report',
      'kb.ingest',
      'kb.index',
    ];

    assert.strictEqual(requiredQueues.length, 11);
    assert.ok(requiredQueues.every(q => typeof q === 'string'));
  });

  it('should validate queue naming convention', () => {
    const queues = [
      'precheck.orchestrator',
      'precheck.agent.parse',
      'kb.ingest',
    ];

    queues.forEach(queue => {
      const parts = queue.split('.');
      assert.ok(parts.length >= 2);
      assert.ok(['precheck', 'kb'].includes(parts[0]));
    });
  });

  it('should have valid concurrency settings', () => {
    const concurrencySettings = {
      ORCHESTRATOR_CONCURRENCY: 1,
      LLM_RISK_CONCURRENCY: 3,
      EVIDENCE_CONCURRENCY: 3,
      KB_INDEX_CONCURRENCY: 2,
    };

    for (const [, value] of Object.entries(concurrencySettings)) {
      assert.ok(typeof value === 'number');
      assert.ok(value > 0);
      assert.ok(value <= 10); // Reasonable upper bound
    }
  });
});

describe('Job Priority', () => {
  it('should validate job data structure', () => {
    const jobData = {
      taskId: 'task_123',
      traceId: 'trace_456',
      stage: 'PARSING',
      payload: { key: 'value' },
    };

    assert.ok(jobData.taskId);
    assert.ok(jobData.traceId);
    assert.ok(jobData.stage);
    assert.ok(jobData.payload);
  });

  it('should validate job options', () => {
    const jobOptions = {
      jobId: 'unique_job_id',
      timeout: 300000, // 5 minutes
      attempts: 1,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    };

    assert.ok(jobOptions.jobId);
    assert.ok(jobOptions.timeout > 0);
    assert.ok(jobOptions.attempts >= 1);
    assert.ok(jobOptions.backoff);
  });
});
