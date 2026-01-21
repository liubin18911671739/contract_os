/**
 * Contract routes
 */
import { FastifyInstance } from 'fastify';
import { contractService } from '../services/contractService.js';
import { CreateContractSchema } from '../schemas/task.js';
import { sql } from '../config/db.js';

export async function contractRoutes(fastify: FastifyInstance) {
  // Create contract
  fastify.post('/contracts', async (request, reply) => {
    const data = CreateContractSchema.parse(request.body);
    const contractId = await contractService.createContract(data);
    reply.code(201).send({ id: contractId });
  });

  // Upload contract version
  fastify.post('/contracts/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };

    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: 'No file uploaded' });
      return;
    }

    const buffer = await data.toBuffer();
    const result = await contractService.uploadContractVersion(
      id,
      buffer,
      data.filename,
      data.mimetype
    );

    reply.send(result);
  });

  // Get contract with versions
  fastify.get('/contracts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [contract] = await sql`
      SELECT * FROM contracts WHERE id = ${id}
    `;

    if (!contract) {
      reply.code(404).send({ error: 'Contract not found' });
      return;
    }

    const versions = await sql`
      SELECT id, version_no, mime, sha256, created_at
      FROM contract_versions
      WHERE contract_id = ${id}
      ORDER BY version_no DESC
    `;

    reply.send({ ...contract, versions });
  });
}
