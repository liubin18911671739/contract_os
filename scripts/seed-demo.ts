/**
 * Seed demo data for testing
 * Usage: npm run seed
 */
import postgres from 'postgres';
import { randomUUID } from 'crypto';

const sql = postgres(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/contract_precheck'
);

async function seed() {
  console.log('Seeding demo data...\n');

  try {
    // Create a demo KB collection
    const collectionId = randomUUID();
    const [collection] = await sql`
      INSERT INTO kb_collections (id, name, scope, version, is_enabled)
      VALUES (${collectionId}, 'Demo Legal Knowledge Base', 'GLOBAL', 1, true)
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `;
    console.log('✓ Created KB collection:', collection?.id || collectionId);

    // Create a demo contract
    const contractId = randomUUID();
    const [contract] = await sql`
      INSERT INTO contracts (id, contract_name, counterparty, contract_type)
      VALUES (${contractId}, 'Demo Service Agreement', 'Acme Corp', 'SERVICE')
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    console.log('✓ Created contract:', contract?.id || contractId);

    console.log('\n✓ Demo data seeded successfully!');
  } catch (error) {
    console.error('✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
