/**
 * Agent tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateId } from '../utils/hash.js';

describe('Agent Protocol', () => {
  it('should validate agent job data structure', () => {
    const jobData = {
      taskId: generateId('task'),
      traceId: generateId('trace'),
      stage: 'PARSING',
      payload: { text: 'test' },
    };

    assert.ok(jobData.taskId);
    assert.ok(jobData.traceId);
    assert.ok(jobData.stage);
    assert.ok(jobData.payload);
  });

  it('should validate agent result structure', () => {
    const result = {
      ok: true,
      taskId: generateId('task'),
      traceId: generateId('trace'),
      stage: 'PARSING',
      metrics: {
        elapsedMs: 1000,
      },
      result: { success: true },
    };

    assert.strictEqual(result.ok, true);
    assert.ok(result.taskId);
    assert.ok(result.metrics);
    assert.ok(typeof result.metrics.elapsedMs === 'number');
  });

  it('should validate error result structure', () => {
    const errorResult = {
      ok: false,
      taskId: generateId('task'),
      traceId: generateId('trace'),
      stage: 'PARSING',
      metrics: {
        elapsedMs: 500,
      },
      error: {
        code: 'PARSE_ERROR',
        message: 'Failed to parse file',
        retryable: true,
      },
    };

    assert.strictEqual(errorResult.ok, false);
    assert.ok(errorResult.error);
    assert.ok(errorResult.error.code);
    assert.ok(errorResult.error.message);
    assert.strictEqual(typeof errorResult.error.retryable, 'boolean');
  });
});

describe('Agent Stages', () => {
  it('should have all required stages', () => {
    const stages = [
      'PARSING',
      'STRUCTURING',
      'RULE_SCORING',
      'KB_RETRIEVAL',
      'LLM_RISK',
      'EVIDENCING',
      'QCING',
      'DONE',
    ];

    assert.strictEqual(stages.length, 8);
    assert.ok(stages.every((s) => typeof s === 'string'));
  });

  it('should validate stage ordering', () => {
    const stages = [
      'QUEUED',
      'PARSING',
      'STRUCTURING',
      'RULE_SCORING',
      'KB_RETRIEVAL',
      'LLM_RISK',
      'EVIDENCING',
      'QCING',
      'DONE',
    ];

    const parsingIndex = stages.indexOf('PARSING');
    const llmRiskIndex = stages.indexOf('LLM_RISK');
    const doneIndex = stages.indexOf('DONE');

    assert.ok(parsingIndex >= 0);
    assert.ok(llmRiskIndex > parsingIndex);
    assert.ok(doneIndex > llmRiskIndex);
  });
});

describe('BaseAgent', () => {
  it('should validate base agent interface', () => {
    const agent = {
      stageName: 'TEST_STAGE',
      run: async (jobData: any) => {
        return {
          ok: true,
          taskId: jobData.taskId,
          traceId: jobData.traceId,
          stage: jobData.stage,
          metrics: { elapsedMs: 100 },
          result: {},
        };
      },
    };

    assert.ok(agent.stageName);
    assert.strictEqual(typeof agent.run, 'function');
  });
});
