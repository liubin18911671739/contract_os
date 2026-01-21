/**
 * Knowledge base service
 */
import { sql } from '../config/db.js';
import { minio } from '../config/minio.js';
import { modelGateway } from '../llm/modelGateway.js';
import { generateId, sha256 } from '../utils/hash.js';
import { logger } from '../config/logger.js';
import type { CreateKBCollection, KBCollection } from '../schemas/kb.js';

export class KBService {
  async createCollection(data: CreateKBCollection): Promise<string> {
    const collectionId = generateId('kbcol');
    await sql`
      INSERT INTO kb_collections (id, name, scope, version, is_enabled)
      VALUES (${collectionId}, ${data.name}, ${data.scope}, 1, true)
    `;
    return collectionId;
  }

  async getCollections(): Promise<KBCollection[]> {
    const collections = await sql<any[]>`
      SELECT id, name, scope, version, is_enabled, created_at
      FROM kb_collections
      WHERE is_enabled = true
      ORDER BY created_at DESC
    `;

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      scope: c.scope,
      version: c.version,
      is_enabled: c.is_enabled,
      created_at: c.created_at.toISOString(),
    }));
  }

  async getCollection(collectionId: string): Promise<KBCollection | null> {
    const [collection] = await sql<any[]>`
      SELECT id, name, scope, version, is_enabled, created_at
      FROM kb_collections
      WHERE id = ${collectionId}
    `;

    if (!collection) return null;

    return {
      id: collection.id,
      name: collection.name,
      scope: collection.scope,
      version: collection.version,
      is_enabled: collection.is_enabled,
      created_at: collection.created_at.toISOString(),
    };
  }

  async uploadDocument(
    collectionId: string,
    file: Buffer,
    filename: string,
    title: string,
    docType: string
  ): Promise<string> {
    const hash = sha256(file.toString('utf-8'));
    const objectKey = `kb/${collectionId}/${Date.now()}-${filename}`;

    // Upload to MinIO
    await minio.putObject(process.env.MINIO_BUCKET || 'contract-precheck', objectKey, file);

    const docId = generateId('kbdoc');
    await sql`
      INSERT INTO kb_documents (id, collection_id, title, doc_type, object_key, version, hash)
      VALUES (${docId}, ${collectionId}, ${title}, ${docType}, ${objectKey}, 1, ${hash})
    `;

    return docId;
  }

  async chunkDocument(documentId: string, text: string): Promise<void> {
    const chunkSize = parseInt(process.env.KB_CHUNK_SIZE || '1000');
    const overlap = parseInt(process.env.KB_CHUNK_OVERLAP || '200');

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.substring(start, end));
      start = end - overlap;
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = generateId('chunk');
      await sql`
        INSERT INTO kb_chunks (id, document_id, chunk_no, text)
        VALUES (${chunkId}, ${documentId}, ${i}, ${chunks[i]})
      `;
    }

    logger.info({ documentId, chunkCount: chunks.length }, 'Document chunked');
  }

  async indexChunks(chunkIds: string[]): Promise<void> {
    const batchSize = 32;
    for (let i = 0; i < chunkIds.length; i += batchSize) {
      const batch = chunkIds.slice(i, i + batchSize);

      const chunks = await sql`
        SELECT id, text FROM kb_chunks WHERE id = ANY(${batch})
      `;

      const texts = chunks.map((c) => c.text);
      const embeddings = await modelGateway.embed(texts);

      for (let j = 0; j < chunks.length; j++) {
        await sql`
          INSERT INTO kb_embeddings (chunk_id, embedding)
          VALUES (${chunks[j].id}, ${JSON.stringify(embeddings[j])}::vector)
          ON CONFLICT (chunk_id) DO UPDATE
          SET embedding = ${JSON.stringify(embeddings[j])}::vector
        `;
      }

      logger.info({ indexed: batch.length }, 'Chunks indexed');
    }
  }

  async search(
    query: string,
    collectionIds: string[],
    topK: number = 20,
    taskId?: string
  ): Promise<Array<{ chunkId: string; text: string; score: number; docTitle: string; docVersion: number }>> {
    // Embed query
    const [queryEmbedding] = await modelGateway.embed([query]);

    // Build collection filter
    let collectionFilter = sql``;
    if (collectionIds.length > 0) {
      collectionFilter = sql` AND d.collection_id = ANY(${collectionIds})`;
    }

    // Apply snapshot filter if taskId provided
    let snapshotFilter = sql``;
    if (taskId) {
      snapshotFilter = sql`
        AND EXISTS (
          SELECT 1 FROM task_kb_snapshots tks
          WHERE tks.task_id = ${taskId}
          AND tks.collection_id = d.collection_id
          AND d.version = tks.collection_version
        )
      `;
    }

    // Vector search
    const results = await sql`
      SELECT
        c.id as chunk_id,
        c.text,
        d.title as doc_title,
        d.version as doc_version,
        e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector as score
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      JOIN kb_embeddings e ON c.id = e.chunk_id
      WHERE 1=1
        ${collectionFilter}
        ${snapshotFilter}
      ORDER BY e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `;

    return results.map((r) => ({
      chunkId: r.chunk_id,
      text: r.text,
      score: r.score,
      docTitle: r.doc_title,
      docVersion: r.doc_version,
    }));
  }

  async getChunk(chunkId: string) {
    const [chunk] = await sql`
      SELECT c.id, c.text, c.meta_json, d.title as doc_title, d.version as doc_version
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE c.id = ${chunkId}
    `;
    return chunk;
  }
}

export const kbService = new KBService();
