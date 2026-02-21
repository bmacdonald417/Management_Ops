import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { processEvidenceBundle, getEvidenceFileContent } from '../services/evidenceIngestor.js';
import { z } from 'zod';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get('/ingest-log', authorize(['Level 1', 'Level 3']), async (_req, res) => {
  const result = await query(
    `SELECT l.id, l.ingest_timestamp, l.status, l.bundle_version, l.trust_codex_version, l.bundle_hash, u.name as ingested_by_name
     FROM cmmc_evidence_ingest_log l
     LEFT JOIN users u ON l.ingested_by_user_id = u.id
     ORDER BY l.ingest_timestamp DESC
     LIMIT 50`
  );
  res.json({ rows: result.rows });
});

router.post(
  '/ingest-evidence-bundle',
  authorize(['Level 1', 'Level 3']),
  upload.single('bundle'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Select a .zip evidence bundle.' });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { ingestId } = await processEvidenceBundle(req.file.buffer, userId);
      res.json({ success: true, ingestId, message: 'Ingest successful!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ingest failed';
      res.status(400).json({ error: message });
    }
  }
);

/** CMMC Level 2: expected control counts per domain (NIST 800-171) */
const CMMC_L2_DOMAIN_TOTALS: Record<string, number> = {
  'Access Control': 22,
  'Awareness and Training': 3,
  'Audit and Accountability': 9,
  'Configuration Management': 9,
  'Identification and Authentication': 11,
  'Incident Response': 3,
  'Maintenance': 6,
  'Media Protection': 9,
  'Personnel Security': 2,
  'Physical Protection': 6,
  'Risk Assessment': 3,
  'Security Assessment': 4,
  'Situational Awareness': 0,
  'System and Communications Protection': 16,
  'System and Information Integrity': 7,
  Other: 0
};

const CMMC_L2_TOTAL = 110;

router.get('/dashboard-summary', async (_req, res) => {
  const adjudicated = await query(
    `SELECT control_id, domain, status FROM cmmc_adjudicated_controls`
  );
  const rows = adjudicated.rows as { control_id: string; domain: string; status: string }[];
  const adjudicatedCount = rows.length;
  const outstandingCount = Math.max(0, CMMC_L2_TOTAL - adjudicatedCount);
  const adjudicatedPercent = CMMC_L2_TOTAL > 0 ? Math.round((adjudicatedCount / CMMC_L2_TOTAL) * 10000) / 100 : 0;

  const byDomain = new Map<
    string,
    { total: number; adjudicated: number; implemented: number; partial: number; not_implemented: number }
  >();
  for (const [name, total] of Object.entries(CMMC_L2_DOMAIN_TOTALS)) {
    if (total > 0) byDomain.set(name, { total, adjudicated: 0, implemented: 0, partial: 0, not_implemented: 0 });
  }
  for (const r of rows) {
    const d = byDomain.get(r.domain);
    if (d) {
      d.adjudicated += 1;
      const s = (r.status || '').toLowerCase();
      if (s.includes('implement') && !s.includes('partial')) d.implemented += 1;
      else if (s.includes('partial') || s === 'partial') d.partial += 1;
      else d.not_implemented += 1;
    } else {
      const s = (r.status || '').toLowerCase();
      const impl = s.includes('implement') && !s.includes('partial') ? 1 : 0;
      const part = s.includes('partial') ? 1 : 0;
      byDomain.set(r.domain, {
        total: CMMC_L2_DOMAIN_TOTALS[r.domain] ?? 0,
        adjudicated: 1,
        implemented: impl,
        partial: part,
        not_implemented: impl === 0 && part === 0 ? 1 : 0
      });
    }
  }

  const domains = Array.from(byDomain.entries())
    .filter(([, d]) => d.total > 0 || d.adjudicated > 0)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    totalControls: CMMC_L2_TOTAL,
    adjudicatedCount,
    outstandingCount,
    adjudicatedPercent,
    domains
  });
});

router.get('/cmmc-dashboard', async (req, res) => {
  const controls = await query('SELECT * FROM cmmc_adjudicated_controls ORDER BY control_id');
  const rows = controls.rows;

  const TOTAL = 110;
  const byStatus = (status: string) => rows.filter((r: { status: string }) => r.status === status).length;
  const implemented = byStatus('implemented');
  const governed = byStatus('governed');
  const inherited = byStatus('inherited');
  const notApplicable = byStatus('not_applicable');
  const partial = byStatus('partially_implemented');
  const applicable = TOTAL - notApplicable;

  // Get latest ingest info
  const ingestLog = await query(
    `SELECT bundle_version, trust_codex_version, bundle_hash, ingest_timestamp 
     FROM cmmc_evidence_ingest_log 
     WHERE status = 'SUCCESS' 
     ORDER BY ingest_timestamp DESC 
     LIMIT 1`
  );
  const latestIngest = ingestLog.rows[0] || null;

  // Domain rollup
  const domainMap: Record<string, any> = {};
  for (const row of rows) {
    const domain = row.domain as string;
    if (!domainMap[domain]) {
      domainMap[domain] = {
        name: domain,
        total: 0,
        implemented: 0,
        partially_implemented: 0,
        governed: 0,
        inherited: 0,
        not_applicable: 0,
        evidenceFiles: 0
      };
    }
    domainMap[domain].total++;
    const status = row.status as string;
    domainMap[domain][status] = (domainMap[domain][status] ?? 0) + 1;
    domainMap[domain].evidenceFiles += (row.evidence_file_count as number) || 0;
  }

  // Calculate total evidence files
  const totalEvidenceFiles = rows.reduce((sum: number, r: { evidence_file_count?: number }) => sum + ((r.evidence_file_count as number) || 0), 0);

  // Adjudicated includes all decided controls: implemented + governed + inherited + not_applicable
  // Outstanding = only partially implemented (in progress)
  const adjudicated = implemented + governed + inherited + notApplicable;
  const outstanding = partial;
  
  res.json({
    summary: {
      totalControls: TOTAL,
      implemented,
      partiallyImplemented: partial,
      governed,
      inherited,
      notApplicable,
      applicable,
      adjudicated, // All adjudicated controls (includes N/A)
      outstanding, // Outstanding = only partially implemented (in progress)
      adjudicatedPercent: TOTAL > 0 ? Math.round((adjudicated / TOTAL) * 100 * 100) / 100 : 0,
      totalEvidenceReferences: totalEvidenceFiles // Total control × file pairs (not unique files)
    },
    buckets: [
      { name: 'Enclave Configuration', total: implemented + partial, implemented: implemented },
      { name: 'Governance', total: governed, implemented: governed },
      { name: 'Inherited', total: inherited, implemented: inherited },
      { name: 'N/A', total: notApplicable, implemented: notApplicable }
    ],
    domains: Object.values(domainMap).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    bundleInfo: latestIngest ? {
      bundleVersion: latestIngest.bundle_version,
      trustCodexVersion: latestIngest.trust_codex_version,
      bundleHash: latestIngest.bundle_hash,
      ingestedAt: latestIngest.ingest_timestamp
    } : null
  });
});

// Get controls for a specific domain with evidence files
router.get('/cmmc-dashboard/domain/:domain', async (req, res) => {
  const { domain } = req.params;

  const controls = await query(
    `SELECT ac.*, 
       COALESCE(
         (SELECT json_agg(json_build_object('filename', filename, 'sha256', sha256))
          FROM cmmc_control_evidence_files
          WHERE control_id = ac.control_id),
         '[]'::json
       ) as evidence_files
     FROM cmmc_adjudicated_controls ac
     WHERE ac.domain = $1
     ORDER BY ac.control_id`,
    [domain]
  );

  res.json({ controls: controls.rows });
});

// Get all evidence references (control × file) with optional filters; plus unique files view
router.get('/cmmc-dashboard/evidence', async (req, res) => {
  const { domain, control_id, status, filename } = req.query;

  let sql = `
    SELECT ac.control_id, ac.domain, ac.status, f.filename, f.sha256
    FROM cmmc_control_evidence_files f
    JOIN cmmc_adjudicated_controls ac ON ac.control_id = f.control_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let i = 1;
  if (domain && typeof domain === 'string') {
    sql += ` AND ac.domain = $${i++}`;
    params.push(domain);
  }
  if (control_id && typeof control_id === 'string') {
    sql += ` AND ac.control_id = $${i++}`;
    params.push(control_id);
  }
  if (status && typeof status === 'string') {
    sql += ` AND ac.status = $${i++}`;
    params.push(status);
  }
  if (filename && typeof filename === 'string' && filename.trim()) {
    sql += ` AND f.filename ILIKE $${i++}`;
    params.push(`%${filename.trim()}%`);
  }
  sql += ` ORDER BY f.filename ASC, ac.control_id ASC`;

  const refResult = await query(sql, params);
  const references = refResult.rows as { control_id: string; domain: string; status: string; filename: string; sha256: string | null }[];

  // Unique files: group by (filename, sha256), list control_ids
  const fileMap = new Map<string, { filename: string; sha256: string | null; control_ids: string[] }>();
  for (const r of references) {
    const key = `${r.filename}\0${r.sha256 ?? ''}`;
    const existing = fileMap.get(key);
    if (existing) {
      if (!existing.control_ids.includes(r.control_id)) existing.control_ids.push(r.control_id);
    } else {
      fileMap.set(key, { filename: r.filename, sha256: r.sha256, control_ids: [r.control_id] });
    }
  }
  const uniqueFiles = Array.from(fileMap.values()).map((f) => ({
    filename: f.filename,
    sha256: f.sha256,
    control_ids: f.control_ids.sort(),
    control_count: f.control_ids.length
  }));

  res.json({ references, uniqueFiles });
});

// Serve evidence file content from the last ingested bundle (for viewing in the dashboard)
router.get('/cmmc-dashboard/evidence/file-content', async (req, res) => {
  const filename = typeof req.query.filename === 'string' ? req.query.filename.trim() : '';
  if (!filename || filename.includes('..') || filename.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid or missing filename' });
  }
  const allowed = await query(
    'SELECT 1 FROM cmmc_control_evidence_files WHERE filename = $1 LIMIT 1',
    [filename]
  );
  if (allowed.rows.length === 0) {
    return res.status(404).json({ error: 'Evidence file not found' });
  }
  try {
    const { content, encoding } = getEvidenceFileContent(filename);
    res.json({ content, encoding });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read evidence file';
    return res.status(404).json({ error: message });
  }
});

router.get('/cmmc/controls', async (req, res) => {
  const { domain, level } = req.query;
  let sql = 'SELECT * FROM cmmc_controls WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (domain) {
    sql += ` AND domain = $${i++}`;
    params.push(domain);
  }
  if (level) {
    sql += ` AND level = $${i++}`;
    params.push(level);
  }
  sql += ' ORDER BY control_identifier ASC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.get('/contracts/:contractId/cmmc', async (req, res) => {
  const { contractId } = req.params;
  const result = await query(
    `SELECT cc.id as control_id, cc.control_identifier, cc.domain, cc.practice_statement, cc.objective,
            ca.implementation_status, ca.assessment_score, ca.evidence_description, ca.last_assessed_at
     FROM cmmc_controls cc
     LEFT JOIN cmmc_assessments ca ON cc.id = ca.control_id AND ca.contract_id = $1
     ORDER BY cc.domain ASC, cc.control_identifier ASC`,
    [contractId]
  );
  res.json(result.rows);
});

router.put(
  '/contracts/:contractId/cmmc/:controlId',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('CMMCAssessment', 'UPDATE'),
  async (req, res) => {
    const { contractId, controlId } = req.params;
    const body = z
      .object({
        implementation_status: z.string(),
        assessment_score: z.number().min(0).max(5).optional(),
        evidence_description: z.string().optional(),
        assessor_notes: z.string().optional()
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO cmmc_assessments (contract_id, control_id, implementation_status, assessment_score, evidence_description, assessor_notes, assessed_by, last_assessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (contract_id, control_id) DO UPDATE SET
         implementation_status = EXCLUDED.implementation_status,
         assessment_score = EXCLUDED.assessment_score,
         evidence_description = EXCLUDED.evidence_description,
         assessor_notes = EXCLUDED.assessor_notes,
         assessed_by = EXCLUDED.assessed_by,
         last_assessed_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        contractId,
        controlId,
        body.implementation_status,
        body.assessment_score ?? null,
        body.evidence_description ?? null,
        body.assessor_notes ?? null,
        req.user?.id
      ]
    );
    res.json(result.rows[0]);
  }
);

router.get('/incidents', async (req, res) => {
  const { status, contract_id } = req.query;
  let sql = 'SELECT * FROM incident_reports WHERE 1=1';
  const params: unknown[] = [];
  let i = 1;
  if (status) {
    sql += ` AND status = $${i++}`;
    params.push(status);
  }
  if (contract_id) {
    sql += ` AND contract_id = $${i++}`;
    params.push(contract_id);
  }
  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

router.post(
  '/incidents',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('IncidentReport', 'CREATE'),
  async (req, res) => {
    const body = z
      .object({
        contract_id: z.string().uuid().optional(),
        incident_level: z.number().min(1).max(4),
        description: z.string(),
        status: z.string().optional(),
        discovered_at: z.string().optional()
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO incident_reports (contract_id, incident_level, description, status, discovered_at, reported_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [
        body.contract_id ?? null,
        body.incident_level,
        body.description,
        body.status ?? 'Investigating',
        body.discovered_at ?? null
      ]
    );
    res.status(201).json(result.rows[0]);
  }
);

router.put(
  '/incidents/:id',
  authorize(['Level 1', 'Level 2', 'Level 3']),
  auditLog('IncidentReport', 'UPDATE'),
  async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const allowed = ['status', 'description', 'incident_level'];
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    for (const k of allowed) {
      if (body[k] !== undefined) {
        updates.push(`${k} = $${i++}`);
        values.push(body[k]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const result = await query(
      `UPDATE incident_reports SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
    res.json(result.rows[0]);
  }
);

export default router;
