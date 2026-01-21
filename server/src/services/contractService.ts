/**
 * Contract service
 */
import { sql } from '../config/db.js';
import { minio } from '../config/minio.js';
import { generateId, sha256 } from '../utils/hash.js';
import type { CreateContract } from '../schemas/task.js';

export class ContractService {
  async createContract(data: CreateContract): Promise<string> {
    const contractId = generateId('contract');
    await sql`
      INSERT INTO contracts (id, contract_name, counterparty, contract_type)
      VALUES (${contractId}, ${data.contract_name}, ${data.counterparty || null}, ${data.contract_type || null})
    `;
    return contractId;
  }

  async getContract(contractId: string) {
    const [contract] = await sql<any[]>`
      SELECT * FROM contracts WHERE id = ${contractId}
    `;
    return contract;
  }

  async uploadContractVersion(
    contractId: string,
    file: Buffer,
    filename: string,
    mime: string
  ): Promise<{ id: string; version: number }> {
    const hash = sha256(file.toString('utf-8'));
    const objectKey = `contracts/${contractId}/${Date.now()}-${filename}`;

    // Upload to MinIO
    await minio.putObject(process.env.MINIO_BUCKET || 'contract-precheck', objectKey, file, {
      'Content-Type': mime,
    });

    // Get current version
    const [lastVersion] = await sql`
      SELECT COALESCE(MAX(version_no), 0) + 1 as next_version
      FROM contract_versions
      WHERE contract_id = ${contractId}
    `;

    const versionId = generateId('ver');
    await sql`
      INSERT INTO contract_versions (id, contract_id, version_no, object_key, sha256, mime)
      VALUES (${versionId}, ${contractId}, ${lastVersion.next_version}, ${objectKey}, ${hash}, ${mime})
    `;

    return { id: versionId, version: lastVersion.next_version };
  }

  async downloadFile(objectKey: string): Promise<Buffer> {
    const stream = await minio.getObject(process.env.MINIO_BUCKET || 'contract-precheck', objectKey);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

export const contractService = new ContractService();
