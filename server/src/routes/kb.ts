/**
 * Knowledge base routes
 */
import { FastifyInstance } from 'fastify';
import { kbService } from '../services/kbService.js';
import { queues } from '../queues/index.js';
import { CreateKBCollectionSchema, KBSearchSchema } from '../schemas/kb.js';
import { sql } from '../config/db.js';

export async function kbRoutes(fastify: FastifyInstance) {
  // Create collection
  fastify.post('/kb/collections', async (request, reply) => {
    const data = CreateKBCollectionSchema.parse(request.body);
    const collectionId = await kbService.createCollection(data);
    reply.code(201).send({ id: collectionId });
  });

  // List collections with document counts
  fastify.get('/kb/collections', async (request, reply) => {
    const collections = await kbService.getCollections();

    // Get document counts for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        const [docCount] = await sql`
          SELECT COUNT(*) as count
          FROM kb_documents
          WHERE collection_id = ${collection.id}
        `;

        const [chunkCount] = await sql`
          SELECT COUNT(*) as count
          FROM kb_chunks kc
          JOIN kb_documents kd ON kc.document_id = kd.id
          WHERE kd.collection_id = ${collection.id}
        `;

        const [indexedCount] = await sql`
          SELECT COUNT(*) as count
          FROM kb_embeddings ke
          JOIN kb_chunks kc ON ke.chunk_id = kc.id
          JOIN kb_documents kd ON kc.document_id = kd.id
          WHERE kd.collection_id = ${collection.id}
        `;

        return {
          ...collection,
          document_count: Number(docCount?.count || 0),
          chunk_count: Number(chunkCount?.count || 0),
          indexed_count: Number(indexedCount?.count || 0),
        };
      })
    );

    reply.send(collectionsWithCounts);
  });

  // Get collection with details
  fastify.get('/kb/collections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await kbService.getCollection(id);

    if (!collection) {
      reply.code(404).send({ error: 'Collection not found' });
      return;
    }

    // Get document counts
    const [docCount] = await sql`
      SELECT COUNT(*) as count
      FROM kb_documents
      WHERE collection_id = ${id}
    `;

    const [chunkCount] = await sql`
      SELECT COUNT(*) as count
      FROM kb_chunks kc
      JOIN kb_documents kd ON kc.document_id = kd.id
      WHERE kd.collection_id = ${id}
    `;

    const [indexedCount] = await sql`
      SELECT COUNT(*) as count
      FROM kb_embeddings ke
      JOIN kb_chunks kc ON ke.chunk_id = kc.id
      JOIN kb_documents kd ON kc.document_id = kd.id
      WHERE kd.collection_id = ${id}
    `;

    reply.send({
      ...collection,
      document_count: Number(docCount?.count || 0),
      chunk_count: Number(chunkCount?.count || 0),
      indexed_count: Number(indexedCount?.count || 0),
    });
  });

  // Upload document
  fastify.post('/kb/documents', async (request, reply) => {
    const data = request.body as any;

    if (!data.file) {
      reply.code(400).send({ error: 'No file uploaded' });
      return;
    }

    const file = await data.file.toBuffer();
    const docId = await kbService.uploadDocument(
      data.collection_id,
      file,
      data.file.filename,
      data.title || data.file.filename,
      data.doc_type || 'unknown'
    );

    // Queue ingest and index
    await queues.kbIngest.add('ingest', { documentId: docId });
    await queues.kbIndex.add('index', { documentId: docId });

    reply.code(201).send({ id: docId });
  });

  // List documents with vectorization status
  fastify.get('/kb/documents', async (request, reply) => {
    const { collection_id } = request.query as any;

    let query = sql`
      SELECT
        kd.id,
        kd.collection_id,
        kd.title,
        kd.doc_type,
        kd.created_at,
        COUNT(DISTINCT kc.id) as chunk_count,
        COUNT(DISTINCT ke.chunk_id) as indexed_count
      FROM kb_documents kd
      LEFT JOIN kb_chunks kc ON kd.id = kc.document_id
      LEFT JOIN kb_embeddings ke ON kc.id = ke.chunk_id
      WHERE 1=1
    `;
    if (collection_id) {
      query = sql`${query} AND kd.collection_id = ${collection_id}`;
    }

    query = sql`${query} GROUP BY kd.id`;

    const documents = await query;

    // Calculate vectorization status for each document
    const documentsWithStatus = documents.map((doc: any) => {
      const chunkCount = Number(doc.chunk_count || 0);
      const indexedCount = Number(doc.indexed_count || 0);

      let status = 'pending';
      if (chunkCount > 0 && indexedCount === 0) {
        status = 'chunking';
      } else if (indexedCount > 0 && indexedCount < chunkCount) {
        status = 'indexing';
      } else if (chunkCount > 0 && indexedCount === chunkCount) {
        status = 'ready';
      }

      return {
        id: doc.id,
        collection_id: doc.collection_id,
        title: doc.title,
        doc_type: doc.doc_type,
        created_at: doc.created_at.toISOString(),
        chunk_count: chunkCount,
        indexed_count: indexedCount,
        status,
      };
    });

    reply.send(documentsWithStatus);
  });

  // Search KB
  fastify.post('/kb/search', async (request, reply) => {
    const data = KBSearchSchema.parse(request.body);

    const results = await kbService.search(
      data.query,
      data.collection_ids || [],
      data.top_k,
      data.task_id
    );

    reply.send(results);
  });

  // Get chunk
  fastify.get('/kb/chunks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chunk = await kbService.getChunk(id);

    if (!chunk) {
      reply.code(404).send({ error: 'Chunk not found' });
      return;
    }

    reply.send(chunk);
  });
}
