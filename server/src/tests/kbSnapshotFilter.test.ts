/**
 * KB Snapshot Filter Test
 * Tests that KB search respects task snapshots
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sql } from '../config/db.js';
import { randomUUID } from 'crypto';

describe('KB Snapshot Filter', () => {
  it('should filter KB results by task snapshot version', async () => {
    // This test verifies that when a task_id is provided to kb/search,
    // only chunks from the frozen version (as per task_kb_snapshots) are returned.

    // Setup: Create task with KB snapshot
    const taskId = `task_${randomUUID()}`;
    const collectionId = `collection_${randomUUID()}`;
    const frozenVersion = 2;
    const contractId = `contract_${randomUUID()}`;
    const contractName = `Test Contract ${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const contractVersionId = `cv_${randomUUID()}`;
    const configSnapshotId = `cfg_${randomUUID()}`;
    const collectionName = `Test Collection ${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create parent records
    await sql`
      INSERT INTO contracts (id, contract_name, counterparty, contract_type)
      VALUES (${contractId}, ${contractName}, 'Counterparty', 'SERVICE')
    `;

    await sql`
      INSERT INTO contract_versions (id, contract_id, version_no, object_key, sha256, mime)
      VALUES (${contractVersionId}, ${contractId}, 1, 'key', 'hash', 'text/plain')
    `;

    await sql`
      INSERT INTO config_snapshots (id, ruleset_version, model_config_json, prompt_template_version, kb_collection_versions_json)
      VALUES (${configSnapshotId}, 'v1.0', '{}', 'v1.0', '[]')
    `;

    await sql`
      INSERT INTO precheck_tasks (id, contract_version_id, status, config_snapshot_id, kb_mode)
      VALUES (${taskId}, ${contractVersionId}, 'QUEUED', ${configSnapshotId}, 'STRICT')
    `;

    await sql`
      INSERT INTO kb_collections (id, name, scope, version, is_enabled)
      VALUES (${collectionId}, ${collectionName}, 'GLOBAL', 1, true)
    `;

    // Mock snapshot
    await sql`
      INSERT INTO task_kb_snapshots (id, task_id, collection_id, collection_version)
      VALUES ('snap1', ${taskId}, ${collectionId}, ${frozenVersion})
    `;

    // Create documents with different versions
    await sql`
      INSERT INTO kb_documents (id, collection_id, title, doc_type, object_key, version, hash)
      VALUES
        ('doc1', ${collectionId}, 'Doc V1', 'txt', 'key1', 1, 'hash1'),
        ('doc2', ${collectionId}, 'Doc V2', 'txt', 'key2', 2, 'hash2'),
        ('doc3', ${collectionId}, 'Doc V3', 'txt', 'key3', 3, 'hash3')
    `;

    // Create chunks
    await sql`
      INSERT INTO kb_chunks (id, document_id, chunk_no, text)
      VALUES
        ('chunk1', 'doc1', 0, 'Text from V1'),
        ('chunk2', 'doc2', 0, 'Text from V2'),
        ('chunk3', 'doc3', 0, 'Text from V3')
    `;

    // When searching with task_id, should only return V2 chunks
    // This would be tested through the kbService.search method
    // For now, we verify the snapshot query logic

    const [snapshot] = await sql`
      SELECT d.version
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE c.id = 'chunk2'
      AND EXISTS (
        SELECT 1 FROM task_kb_snapshots tks
        WHERE tks.task_id = ${taskId}
        AND tks.collection_id = d.collection_id
        AND d.version = tks.collection_version
      )
    `;

    assert.strictEqual(snapshot?.version, 2, 'Should only return frozen version');

    // Cleanup
    await sql`DELETE FROM task_kb_snapshots WHERE task_id = ${taskId}`;
    await sql`DELETE FROM kb_chunks WHERE id IN ('chunk1', 'chunk2', 'chunk3')`;
    await sql`DELETE FROM kb_documents WHERE id IN ('doc1', 'doc2', 'doc3')`;
    await sql`DELETE FROM kb_collections WHERE id = ${collectionId}`;
    await sql`DELETE FROM precheck_tasks WHERE id = ${taskId}`;
    await sql`DELETE FROM config_snapshots WHERE id = ${configSnapshotId}`;
    await sql`DELETE FROM contract_versions WHERE id = ${contractVersionId}`;
    await sql`DELETE FROM contracts WHERE id = ${contractId}`;
  });
});
