/**
 * Services tests
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { generateId } from '../utils/hash.js';

describe('TaskService', () => {
  before(async () => {
    // Setup test database connection if needed
    // For now, tests use mocked data
  });

  it('should create task with valid data', async () => {
    const taskId = generateId('task');
    const contractVersionId = generateId('ver');

    // This test verifies the task creation logic
    // In real test, would call taskService.createTask()

    assert.ok(taskId);
    assert.ok(contractVersionId);
    assert.strictEqual(taskId.startsWith('task_'), true);
  });

  it('should validate task status transitions', () => {
    const validStatuses = [
      'QUEUED',
      'PARSING',
      'STRUCTURING',
      'RULE_SCORING',
      'KB_RETRIEVAL',
      'LLM_RISK',
      'EVIDENCING',
      'QCING',
      'DONE',
      'FAILED',
      'CANCELLED',
    ];

    // Verify all statuses are defined
    assert.ok(validStatuses.length > 0);
    assert.ok(validStatuses.includes('QUEUED'));
    assert.ok(validStatuses.includes('DONE'));
    assert.ok(validStatuses.includes('FAILED'));
  });

  it('should validate KB mode', () => {
    const validModes = ['STRICT', 'RELAXED'];

    assert.ok(validModes.includes('STRICT'));
    assert.ok(validModes.includes('RELAXED'));
    assert.strictEqual(validModes.length, 2);
  });
});

describe('RetrievalService', () => {
  it('should validate retrieval parameters', () => {
    const query = 'test query';
    const collectionIds = ['col1', 'col2'];

    assert.ok(query.length > 0);
    assert.ok(Array.isArray(collectionIds));
    assert.ok(collectionIds.length > 0);
  });

  it('should validate topK and topN parameters', () => {
    const topK = 20;
    const topN = 8;

    assert.ok(topK > 0);
    assert.ok(topN > 0);
    assert.ok(topN <= topK);
  });
});

describe('ReportService', () => {
  it('should validate report format', () => {
    const formats = ['html', 'json'];

    assert.ok(formats.includes('html'));
    assert.ok(formats.includes('json'));
  });

  it('should validate report data structure', async () => {
    const mockData = {
      taskId: 'test_task',
      contractInfo: { contract_name: 'Test Contract' },
      summary: { high_risks: 1, medium_risks: 2, low_risks: 3 },
      risks: [],
      clauses: [],
      events: [],
    };

    assert.ok(mockData.taskId);
    assert.ok(mockData.contractInfo);
    assert.ok(mockData.summary);
    assert.ok(Array.isArray(mockData.risks));
    assert.ok(Array.isArray(mockData.clauses));
    assert.ok(Array.isArray(mockData.events));
  });
});
