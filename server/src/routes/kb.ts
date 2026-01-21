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

  // List collections
  fastify.get('/kb/collections', async (request, reply) => {
    const collections = await kbService.getCollections();
    reply.send(collections);
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

  // List documents
  fastify.get('/kb/documents', async (request, reply) => {
    const { collection_id } = request.query as any;

    let query = sql`SELECT id, collection_id, title, doc_type, created_at FROM kb_documents WHERE 1=1`;
    if (collection_id) {
      query = sql`${query} AND collection_id = ${collection_id}`;
    }

    const documents = await query;
    reply.send(documents);
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
