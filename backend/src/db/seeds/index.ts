import { seedFARDFARSClauses } from './01_import_clauses.js';
import { seedNISTControls } from './02_import_nist_controls.js';
import { seedDevData } from './03_seed_dev_data.js';
import { seedGovernanceEngine } from './04_governance_engine.js';
import { pool } from '../connection.js';

async function runSeeds() {
  try {
    console.log('🌱 Starting database seeding...');
    await seedFARDFARSClauses();
    await seedNISTControls();
    await seedDevData();
    await seedGovernanceEngine();
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runSeeds().catch(() => process.exit(1));
