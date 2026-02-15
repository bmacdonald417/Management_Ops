import { query } from '../../db/connection.js';
import type { RegistryCategory } from './types.js';

export async function setActiveVersionForCategory(
  category: RegistryCategory,
  dataSourceId: string
): Promise<void> {
  await query(
    `UPDATE compliance_data_sources SET is_active = false WHERE category = $1`,
    [category]
  );
  await query(
    `UPDATE compliance_data_sources SET is_active = true WHERE id = $2 AND category = $1`,
    [category, dataSourceId]
  );
}

export async function getActiveDataSourceId(category: RegistryCategory): Promise<string | null> {
  const r = await query(
    `SELECT id FROM compliance_data_sources WHERE category = $1 AND is_active = true AND validation_status = 'VALID' LIMIT 1`,
    [category]
  );
  const row = r.rows[0] as { id: string } | undefined;
  return row?.id ?? null;
}

export async function listDataSourcesByCategory(
  category?: RegistryCategory
): Promise<{ id: string; name: string; category: string; version: string; validationStatus: string; recordCount: number; isActive: boolean; importedAt: string }[]> {
  let sql = `SELECT id, name, category, version, validation_status as "validationStatus", record_count as "recordCount", is_active as "isActive", imported_at as "importedAt"
             FROM compliance_data_sources WHERE 1=1`;
  const params: unknown[] = [];
  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  sql += ` ORDER BY category, imported_at DESC`;
  const r = await query(sql, params);
  return r.rows as { id: string; name: string; category: string; version: string; validationStatus: string; recordCount: number; isActive: boolean; importedAt: string }[];
}
