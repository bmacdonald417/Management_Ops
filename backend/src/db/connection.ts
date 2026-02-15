import pg from 'pg';
import dotenv from 'dotenv';

// Dotenv only for local dev; production uses Railway env vars (no .env required)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/mactech_governance',
  max: 20,
  idleTimeoutMillis: 30000
});

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  return pool.query(text, params);
}
