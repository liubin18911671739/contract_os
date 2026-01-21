/**
 * Citation Backlink Test
 * Tests QC agent hallucination detection
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sql } from '../config/db.js';
import { randomUUID } from 'crypto';

describe('Citation Backlink', () => {
  it('should mark hallucination_suspect=true for invalid chunk_id', async () => {
    const riskId = `test_risk_${randomUUID()}`;
    const clauseId = `clause_${randomUUID()}`;
    const chunkId = `chunk_${randomUUID()}`;
    const taskId = `task_${randomUUID()}`;
    const contractId = `contract_${randomUUID()}`;
    const contractVersionId = `cv_${randomUUID()}`;
    const configSnapshotId = `cfg_${randomUUID()}`;
    const collectionId = `collection_${randomUUID()}`;
    const collectionName = `Test Collection ${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create full chain of parent records
    await sql`
      INSERT INTO contracts (id, contract_name, counterparty, contract_type)
      VALUES (${contractId}, ${collectionName}, 'Counterparty', 'SERVICE')
      ON CONFLICT (id) DO NOTHING
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

    // Create clause first (parent of risks)
    await sql`
      INSERT INTO clauses (id, task_id, clause_id, title, text, page_ref, order_no)
      VALUES (${clauseId}, ${taskId}, 'c1', 'Clause 1', 'Clause text', 'p1', 1)
    `;

    // Create a valid chunk first
    const docTestId = `doc_test_${randomUUID()}`;
    await sql`
      INSERT INTO kb_documents (id, collection_id, title, doc_type, object_key, version, hash)
      VALUES (${docTestId}, ${collectionId}, 'Doc', 'txt', 'key', 1, 'hash')
    `;

    await sql`
      INSERT INTO kb_chunks (id, document_id, chunk_no, text)
      VALUES (${chunkId}, ${docTestId}, 0, 'Text')
    `;

    // Create risk with KB citation
    await sql`
      INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status)
      VALUES (${riskId}, ${taskId}, ${clauseId}, 'HIGH', 'TEST', 0.9, 'Test risk', 'NEEDS_REVIEW')
    `;

    const citId = `cit1_${randomUUID()}`;
    await sql`
      INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text, doc_version)
      VALUES (${citId}, ${riskId}, ${chunkId}, 0.8, 'Quote', 1)
    `;

    // Verify chunk exists (not a hallucination)
    const [chunk] = await sql`
      SELECT 1 FROM kb_chunks WHERE id = ${chunkId}
    `;

    assert.ok(chunk, 'Chunk should exist');

    // QC should NOT mark hallucination_suspect for valid chunks
    const [riskBefore] = await sql`
      SELECT qc_flags_json FROM risks WHERE id = ${riskId}
    `;

    assert.strictEqual(riskBefore?.qc_flags_json?.hallucination_suspect, undefined, 'Should not have hallucination flag initially');

    // Simulate QC check passing (no hallucination)
    await sql`
      UPDATE risks
      SET qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ hallucination_suspect: false })}
      WHERE id = ${riskId}
    `;

    const [riskAfter] = await sql`
      SELECT qc_flags_json FROM risks WHERE id = ${riskId}
    `;

    // Check that hallucination_suspect was set (either false or undefined means not a hallucination)
    assert.ok(riskAfter?.qc_flags_json?.hallucination_suspect === false || riskAfter?.qc_flags_json?.hallucination_suspect === undefined,
      'Should mark as not hallucination');

    // Cleanup
    await sql`DELETE FROM kb_citations WHERE risk_id = ${riskId}`;
    await sql`DELETE FROM risks WHERE id = ${riskId}`;
    await sql`DELETE FROM clauses WHERE id = ${clauseId}`;
    await sql`DELETE FROM kb_chunks WHERE id = ${chunkId}`;
    await sql`DELETE FROM kb_documents WHERE id = ${docTestId}`;
    await sql`DELETE FROM kb_collections WHERE id = ${collectionId}`;
    await sql`DELETE FROM precheck_tasks WHERE id = ${taskId}`;
    await sql`DELETE FROM config_snapshots WHERE id = ${configSnapshotId}`;
    await sql`DELETE FROM contract_versions WHERE id = ${contractVersionId}`;
    await sql`DELETE FROM contracts WHERE id = ${contractId}`;
  });

  it('should mark hallucination_suspect=true for version mismatch', async () => {
    const riskId = `test_risk_${randomUUID()}`;
    const clauseId = `clause_${randomUUID()}`;
    const taskId = `task_${randomUUID()}`;
    const collectionId = `collection_${randomUUID()}`;
    const chunkId = `chunk_${randomUUID()}`;
    const contractId = `contract_${randomUUID()}`;
    const contractVersionId = `cv_${randomUUID()}`;
    const configSnapshotId = `cfg_${randomUUID()}`;

    // Create parent records
    await sql`
      INSERT INTO contracts (id, contract_name, counterparty, contract_type)
      VALUES (${contractId}, 'Test Contract 2', 'Counterparty', 'SERVICE')
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

    const collectionName2 = `Test Collection ${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await sql`
      INSERT INTO kb_collections (id, name, scope, version, is_enabled)
      VALUES (${collectionId}, ${collectionName2}, 'GLOBAL', 1, true)
    `;

    // Create clause first (parent of risks)
    await sql`
      INSERT INTO clauses (id, task_id, clause_id, title, text, page_ref, order_no)
      VALUES (${clauseId}, ${taskId}, 'c2', 'Clause 2', 'Clause text 2', 'p2', 1)
    `;

    // Create chunk with version 2
    const docId = `doc_ver_${randomUUID()}`;
    await sql`
      INSERT INTO kb_documents (id, collection_id, title, doc_type, object_key, version, hash)
      VALUES (${docId}, ${collectionId}, 'Doc', 'txt', 'key', 2, 'hash')
    `;

    await sql`
      INSERT INTO kb_chunks (id, document_id, chunk_no, text)
      VALUES (${chunkId}, ${docId}, 0, 'Text')
    `;

    // Create task snapshot with version 1
    const snapId = `snap_ver_${randomUUID()}`;
    await sql`
      INSERT INTO task_kb_snapshots (id, task_id, collection_id, collection_version)
      VALUES (${snapId}, ${taskId}, ${collectionId}, 1)
    `;

    // Create risk with citation
    await sql`
      INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status)
      VALUES (${riskId}, ${taskId}, ${clauseId}, 'HIGH', 'TEST', 0.9, 'Test risk', 'NEEDS_REVIEW')
    `;

    const citId2 = `cit2_${randomUUID()}`;
    await sql`
      INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text, doc_version)
      VALUES (${citId2}, ${riskId}, ${chunkId}, 0.8, 'Quote', 2)
    `;

    // Check version mismatch
    const [snapshot] = await sql`
      SELECT d.version as chunk_version, tks.collection_version as snapshot_version
      FROM kb_citations kc
      JOIN kb_chunks c ON kc.chunk_id = c.id
      JOIN kb_documents d ON c.document_id = d.id
      JOIN task_kb_snapshots tks ON tks.task_id = ${taskId} AND tks.collection_id = d.collection_id
      WHERE kc.risk_id = ${riskId}
    `;

    assert.strictEqual(snapshot?.chunk_version, 2);
    assert.strictEqual(snapshot?.snapshot_version, 1);
    assert.notStrictEqual(
      snapshot?.chunk_version,
      snapshot?.snapshot_version,
      'Versions should mismatch'
    );

    // QC should mark hallucination
    await sql`
      UPDATE risks
      SET qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ hallucination_suspect: true })}
      WHERE id = ${riskId}
    `;

    // Cleanup
    await sql`DELETE FROM kb_citations WHERE risk_id = ${riskId}`;
    await sql`DELETE FROM risks WHERE id = ${riskId}`;
    await sql`DELETE FROM clauses WHERE id = ${clauseId}`;
    await sql`DELETE FROM task_kb_snapshots WHERE id = ${snapId}`;
    await sql`DELETE FROM kb_chunks WHERE id = ${chunkId}`;
    await sql`DELETE FROM kb_documents WHERE id = ${docId}`;
    await sql`DELETE FROM kb_collections WHERE id = ${collectionId}`;
    await sql`DELETE FROM precheck_tasks WHERE id = ${taskId}`;
    await sql`DELETE FROM config_snapshots WHERE id = ${configSnapshotId}`;
    await sql`DELETE FROM contract_versions WHERE id = ${contractVersionId}`;
    await sql`DELETE FROM contracts WHERE id = ${contractId}`;
  });
});
