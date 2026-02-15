import { query } from '../../db/connection.js';

export interface KBStats {
  documentsCount: number;
  chunksCount: number;
  embeddedCount: number;
  embeddingCoverage: number;
}

export async function getKBStats(): Promise<KBStats> {
  let documentsCount = 0;
  let chunksCount = 0;
  let embeddedCount = 0;

  try {
    const docR = (await query(`SELECT COUNT(*) as c FROM compliance_documents WHERE is_active = true`)).rows[0] as { c: string };
    documentsCount = parseInt(docR?.c ?? '0', 10);
  } catch {
    //
  }
  try {
    const chunkR = (await query(`SELECT COUNT(*) as c FROM compliance_chunks`)).rows[0] as { c: string };
    chunksCount = parseInt(chunkR?.c ?? '0', 10);
  } catch {
    //
  }
  try {
    const embR = (await query(`SELECT COUNT(*) as c FROM compliance_chunks WHERE embedding IS NOT NULL`)).rows[0] as { c: string };
    embeddedCount = parseInt(embR?.c ?? '0', 10);
  } catch {
    //
  }

  const embeddingCoverage = chunksCount > 0 ? embeddedCount / chunksCount : 0;

  return {
    documentsCount,
    chunksCount,
    embeddedCount,
    embeddingCoverage
  };
}
