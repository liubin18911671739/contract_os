/**
 * Seed demo data for testing
 * Usage: npm run seed
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/contract_precheck');

async function seed() {
  console.log('Seeding demo data...\n');

  try {
    // Create a demo KB collection
    const [collection] = await sql`
      INSERT INTO kb_collections (name, scope, version, is_enabled)
      VALUES ('Demo Legal Knowledge Base', 'GLOBAL', 1, true)
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `;
    console.log('✓ Created KB collection:', collection?.id);

    // Create a demo contract
    const [contract] = await sql`
      INSERT INTO contracts (contract_name, counterparty, contract_type)
      VALUES ('Demo Service Agreement', 'Acme Corp', 'SERVICE')
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    console.log('✓ Created contract:', contract?.id);

    console.log('\n✓ Demo data seeded successfully!');
  } catch (error) {
    console.error('✗ Seeding failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
