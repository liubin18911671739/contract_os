/**
 * KB ingest and index workers
 */
import { createWorker } from '../../queues/index.js';
import { kbService } from '../../services/kbService.js';
import { fileParser } from '../../utils/fileParser.js';
import { sql } from '../../config/db.js';
import { minio } from '../../config/minio.js';
import { logger } from '../../config/logger.js';

// Ingest worker - parses document and creates chunks
export const ingestWorker = createWorker(
  'kb.ingest',
  async (job) => {
    const { documentId } = job.data;

    // Get document info
    const [doc] = await sql`
      SELECT object_key, doc_type, title FROM kb_documents WHERE id = ${documentId}
    `;

    if (!doc) {
      throw new Error('Document not found');
    }

    // Download file from MinIO
    const stream = await minio.getObject(process.env.MINIO_BUCKET || 'contract-precheck', doc.object_key);
    const chunks: Buffer[] = [];

    await new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const file = Buffer.concat(chunks);

    // Determine MIME type from doc_type
    let mime = 'text/plain';
    if (doc.doc_type === 'pdf') mime = 'application/pdf';
    else if (doc.doc_type === 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (doc.doc_type === 'txt') mime = 'text/plain';

    // Parse file
    let text = '';
    try {
      const parseResult = await fileParser.parse(file, mime, doc.title);
      text = parseResult.text;
    } catch (error) {
      logger.error({ documentId, docType: doc.doc_type, error }, 'KB document parsing failed');
      throw error;
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Parsed document text is empty');
    }

    logger.info({ documentId, textLength: text.length }, 'Document parsed for chunking');

    // Chunk document
    await kbService.chunkDocument(documentId, text);

    return { success: true, textLength: text.length };
  },
  { concurrency: 2 }
);

// Index worker - generates embeddings for chunks
export const indexWorker = createWorker(
  'kb.index',
  async (job) => {
    const { documentId } = job.data;

    // Get all chunks for document
    const chunks = await sql`
      SELECT id FROM kb_chunks WHERE document_id = ${documentId}
    `;

    const chunkIds = chunks.map((c: any) => c.id);

    if (chunkIds.length === 0) {
      logger.warn({ documentId }, 'No chunks found for indexing');
      return { indexed: 0 };
    }

    // Generate embeddings
    await kbService.indexChunks(chunkIds);

    logger.info({ documentId, indexed: chunkIds.length }, 'Chunks indexed');

    return { indexed: chunkIds.length };
  },
  { concurrency: parseInt(process.env.KB_INDEX_CONCURRENCY || '2') }
);
