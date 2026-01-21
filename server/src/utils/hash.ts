/**
 * Hash utilities
 */
import { createHash } from 'crypto';

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}${random}`;
}
