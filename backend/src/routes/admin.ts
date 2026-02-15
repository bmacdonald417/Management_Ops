import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ingestCsv } from '../services/complianceRegistry/ingestion.js';
import { setActiveVersionForCategory } from '../services/complianceRegistry/versionControl.js';
import { getRegistryStats } from '../services/complianceRegistry/registryStats.js';
import { z } from 'zod';
import type { RegistryCategory } from '../services/complianceRegistry/types.js';

const router = Router();
router.use(authenticate);
router.use(authorize(['Level 1', 'Level 3'])); // SysAdmin, Quality

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string; originalname: string }, cb: (err: Error | null, accept?: boolean) => void) => {
    const ok = ['text/csv', 'application/csv', 'application/json', 'text/plain'].includes(file.mimetype) ||
      file.originalname.endsWith('.csv') || file.originalname.endsWith('.json');
    cb(null, !!ok);
  }
});

router.get('/compliance-registry/sources', async (req, res) => {
  const { category } = req.query;
  const params: unknown[] = [];
  const where = category ? ' WHERE category = $1' : '';
  if (category) params.push(category);
  const r = await query(
    `SELECT id, name, category, version, effective_date as "effectiveDate", file_name as "fileName", record_count as "recordCount",
            hash_fingerprint as "hashFingerprint", validation_status as "validationStatus", imported_at as "importedAt",
            imported_by as "importedBy", is_active as "isActive"
     FROM compliance_data_sources${where}
     ORDER BY category, imported_at DESC`,
    params
  );
  res.json(r.rows);
});

router.get('/compliance-registry/stats', async (_req, res) => {
  const stats = await getRegistryStats();
  res.json(stats);
});

router.get('/compliance-registry/sources/:id/errors', async (req, res) => {
  const { id } = req.params;
  const r = await query(
    `SELECT row_index as "rowIndex", field_name as "fieldName", error_code as "errorCode", error_message as "errorMessage", raw_value as "rawValue"
     FROM compliance_registry_errors WHERE data_source_id = $1 ORDER BY row_index LIMIT 200`,
    [id]
  );
  res.json(r.rows);
});

router.post('/compliance-registry/upload', upload.single('file'), async (req, res) => {
  const file = (req as { file?: { buffer: Buffer; originalname: string } }).file;
  if (!file?.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const body = z.object({
    category: z.enum(['FAR', 'DFARS', 'CMMC', 'NIST', 'ISO', 'INSURANCE', 'COST_ACCOUNT', 'INTERNAL']),
    version: z.string().min(1),
    name: z.string().min(1),
    effectiveDate: z.string().optional()
  }).parse(req.body);

  const content = file.buffer.toString('utf8');
  const fileName = file.originalname || 'upload.csv';

  const result = await ingestCsv(
    content,
    fileName,
    body.category as RegistryCategory,
    body.version,
    body.name,
    body.effectiveDate,
    req.user!.id
  );
  res.status(201).json(result);
});

router.post('/compliance-registry/sources/:id/activate', async (req, res) => {
  const { id } = req.params;
  const ds = (await query(
    `SELECT category, validation_status FROM compliance_data_sources WHERE id = $1`,
    [id]
  )).rows[0] as { category: string; validation_status: string } | undefined;
  if (!ds) return res.status(404).json({ error: 'Data source not found' });
  if (ds.validation_status !== 'VALID') {
    return res.status(400).json({ error: 'Only VALID sources can be activated' });
  }
  await setActiveVersionForCategory(ds.category as RegistryCategory, id);
  res.json({ ok: true });
});

export default router;
