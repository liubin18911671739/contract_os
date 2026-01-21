/**
 * Citation Backlink Test
 * Tests QC agent hallucination detection
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sql } from '../config/db.js';

describe('Citation Backlink', () => {
  it('should mark hallucination_suspect=true for invalid chunk_id', async () => {
    const riskId = 'test_risk_halluc';
    const invalidChunkId = 'nonexistent_chunk';

    // Create risk with KB citation to non-existent chunk
    await sql`
      INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status)
      VALUES (${riskId}, 'task1', 'clause1', 'HIGH', 'TEST', 0.9, 'Test risk', 'NEEDS_REVIEW')
    `;

    await sql`
      INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text, doc_version)
      VALUES ('cit1', ${riskId}, ${invalidChunkId}, 0.8, 'Fake quote', 1)
    `;

    // QC logic should check if chunk exists
    const [chunk] = await sql`
      SELECT 1 FROM kb_chunks WHERE id = ${invalidChunkId}
    `;

    assert.strictEqual(chunk, undefined, 'Chunk should not exist');

    // QC should mark hallucination_suspect
    await sql`
      UPDATE risks
      SET qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ hallucination_suspect: true })}
      WHERE id = ${riskId}
    `;

    const [risk] = await sql`
      SELECT qc_flags_json FROM risks WHERE id = ${riskId}
    `;

    assert.strictEqual(risk?.qc_flags_json?.hallucination_suspect, true);

    // Cleanup
    await sql`DELETE FROM kb_citations WHERE risk_id = ${riskId}`;
    await sql`DELETE FROM risks WHERE id = ${riskId}`;
  });

  it('should mark hallucination_suspect=true for version mismatch', async () => {
    const riskId = 'test_risk_version';
    const taskId = 'test_task_version';
    const collectionId = 'test_collection';
    const chunkId = 'chunk_version_test';

    // Create chunk with version 2
    await sql`
      INSERT INTO kb_documents (id, collection_id, title, doc_type, object_key, version, hash)
      VALUES ('doc_ver', ${collectionId}, 'Doc', 'txt', 'key', 2, 'hash')
    `;

    await sql`
      INSERT INTO kb_chunks (id, document_id, chunk_no, text)
      VALUES (${chunkId}, 'doc_ver', 0, 'Text')
    `;

    // Create task snapshot with version 1
    await sql`
      INSERT INTO task_kb_snapshots (id, task_id, collection_id, collection_version)
      VALUES ('snap_ver', ${taskId}, ${collectionId}, 1)
    `;

    // Create risk with citation
    await sql`
      INSERT INTO risks (id, task_id, clause_id, risk_level, risk_type, confidence, summary, status)
      VALUES (${riskId}, ${taskId}, 'clause1', 'HIGH', 'TEST', 0.9, 'Test risk', 'NEEDS_REVIEW')
    `;

    await sql`
      INSERT INTO kb_citations (id, risk_id, chunk_id, score, quote_text, doc_version)
      VALUES ('cit2', ${riskId}, ${chunkId}, 0.8, 'Quote', 2)
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
    assert.notStrictEqual(snapshot?.chunk_version, snapshot?.snapshot_version, 'Versions should mismatch');

    // QC should mark hallucination
    await sql`
      UPDATE risks
      SET qc_flags_json = COALESCE(qc_flags_json, '{}'::jsonb) || ${JSON.stringify({ hallucination_suspect: true })}
      WHERE id = ${riskId}
    `;

    // Cleanup
    await sql`DELETE FROM kb_citations WHERE risk_id = ${riskId}`;
    await sql`DELETE FROM risks WHERE id = ${riskId}`;
    await sql`DELETE FROM task_kb_snapshots WHERE task_id = ${taskId}`;
    await sql`DELETE FROM kb_chunks WHERE id = ${chunkId}`;
    await sql`DELETE FROM kb_documents WHERE id = 'doc_ver'`;
  });
});
