/**
 * Knowledge base schemas
 */
import { z } from 'zod';

export const CreateKBCollectionSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(['GLOBAL', 'TENANT', 'PROJECT', 'DEPT']),
});

export const CreateKBDocumentSchema = z.object({
  collection_id: z.string(),
  file: z.any(), // MultipartFile
  title: z.string().min(1),
  doc_type: z.string().optional(),
});

export const KBSearchSchema = z.object({
  query: z.string().min(1),
  collection_ids: z.array(z.string()).optional(),
  top_k: z.number().min(1).max(100).optional().default(20),
  task_id: z.string().optional(),
});

export const KBCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(['GLOBAL', 'TENANT', 'PROJECT', 'DEPT']),
  version: z.number(),
  is_enabled: z.boolean(),
  created_at: z.string().datetime(),
});

export const KBDocumentSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  title: z.string(),
  doc_type: z.string(),
  object_key: z.string(),
  version: z.number(),
  created_at: z.string().datetime(),
});

export const KBChunkSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  chunk_no: z.number(),
  text: z.string(),
  meta: z.any().optional(),
});

export const KBSearchResultSchema = z.object({
  chunk_id: z.string(),
  text: z.string(),
  score: z.number(),
  doc_title: z.string(),
  doc_version: z.number(),
  meta: z.any().optional(),
});

export type CreateKBCollection = z.infer<typeof CreateKBCollectionSchema>;
export type CreateKBDocument = z.infer<typeof CreateKBDocumentSchema>;
export type KBSearch = z.infer<typeof KBSearchSchema>;
export type KBCollection = z.infer<typeof KBCollectionSchema>;
export type KBDocument = z.infer<typeof KBDocumentSchema>;
export type KBChunk = z.infer<typeof KBChunkSchema>;
export type KBSearchResult = z.infer<typeof KBSearchResultSchema>;
