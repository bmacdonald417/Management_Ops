/**
 * Cryptographic signature requests and artifacts.
 * QMS can fetch artifacts to verify without changing its hashing.
 */
import { Router, type Request } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { buildCanonicalPayload, signCanonical, isSigningConfigured } from '../services/signatureService.js';
import { z } from 'zod';

const router = Router();

function getClientIp(req: Request): string | null {
  const ff = req.headers['x-forwarded-for'];
  if (ff && typeof ff === 'string') return ff.split(',')[0]?.trim() ?? null;
  return req.ip ?? null;
}

function getUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : null;
}

// GET /api/signatures/requests — list pending (authenticated)
router.get('/requests', authenticate, async (req, res) => {
  const pending = (await query(
    `SELECT sr.id, sr.record_type as "recordType", sr.record_id as "recordId",
            sr.record_version as "recordVersion", sr.qms_hash as "qmsHash", sr.title, sr.approval_type as "approvalType"
     FROM signature_requests sr
     LEFT JOIN signature_artifacts sa ON sa.record_id = sr.record_id AND sa.record_version = sr.record_version
     WHERE sr.status = 'PENDING' AND sa.id IS NULL
     ORDER BY sr.created_at DESC`
  )).rows;
  res.json({ requests: pending, signingConfigured: isSigningConfigured() });
});

// POST /api/signatures/requests — create signature request (e.g. from finalize flow)
router.post(
  '/requests',
  authenticate,
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (req, res) => {
    const body = z.object({
      recordType: z.string().min(1),
      recordId: z.string().min(1),
      recordVersion: z.number().int().positive().default(1),
      qmsHash: z.string().min(1),
      title: z.string().min(1),
      approvalType: z.string().optional()
    }).parse(req.body);

    await query(
      `INSERT INTO signature_requests (record_type, record_id, record_version, qms_hash, title, approval_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (record_type, record_id, record_version) DO UPDATE SET
         qms_hash = EXCLUDED.qms_hash, title = EXCLUDED.title, status = 'PENDING', approval_type = EXCLUDED.approval_type`,
      [body.recordType, body.recordId, body.recordVersion, body.qmsHash, body.title, body.approvalType ?? null]
    );
    const row = (await query(
      `SELECT id, record_type as "recordType", record_id as "recordId", record_version as "recordVersion", qms_hash as "qmsHash", title FROM signature_requests
       WHERE record_type = $1 AND record_id = $2 AND record_version = $3`,
      [body.recordType, body.recordId, body.recordVersion]
    )).rows[0];
    res.status(201).json(row);
  }
);

// POST /api/signatures/requests/:id/sign — sign and create artifact
router.post(
  '/requests/:id/sign',
  authenticate,
  authorize(['Level 1', 'Level 2', 'Level 3']),
  async (req, res) => {
    const { id } = req.params;
    if (!isSigningConfigured()) {
      return res.status(503).json({ error: 'Signing not configured. Set GOV_ED25519_PRIVATE_KEY.' });
    }

    const row = (await query(
      `SELECT * FROM signature_requests WHERE id = $1 AND status = 'PENDING'`,
      [id]
    )).rows[0] as { record_type: string; record_id: string; record_version: number; qms_hash: string; approval_type: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Request not found or already signed' });

    const existing = (await query(
      `SELECT id FROM signature_artifacts WHERE record_id = $1 AND record_version = $2`,
      [row.record_id, row.record_version]
    )).rows[0];
    if (existing) return res.status(409).json({ error: 'Already signed' });

    const signedAt = new Date();
    const signedBy = (req.user as { email?: string; name?: string })?.email ?? (req.user as { name?: string })?.name ?? 'unknown';
    const { canonical } = buildCanonicalPayload({
      qmsHash: row.qms_hash,
      recordType: row.record_type,
      recordId: row.record_id,
      recordVersion: row.record_version,
      approvalType: row.approval_type ?? 'CLAUSE_ASSESSMENT',
      signedAt,
      signedBy,
      controlTags: ['governance', 'clause-assessment']
    });

    const result = signCanonical(canonical);
    if (!result) return res.status(500).json({ error: 'Signing failed' });

    await query(
      `INSERT INTO signature_artifacts (algorithm, signature, payload_canonical, qms_hash, record_type, record_id, record_version, approval_type, signed_at, signed_by, public_key_id, client_ip, user_agent)
       VALUES ('ED25519', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        result.signatureBase64,
        canonical,
        row.qms_hash,
        row.record_type,
        row.record_id,
        row.record_version,
        row.approval_type ?? 'CLAUSE_ASSESSMENT',
        signedAt,
        signedBy,
        result.publicKeyId,
        getClientIp(req),
        getUserAgent(req)
      ]
    );

    await query(
      `UPDATE signature_requests SET status = 'SIGNED' WHERE id = $1`,
      [id]
    );

    const artifact = (await query(
      `SELECT id, algorithm, signature, qms_hash as "qmsHash", record_type as "recordType", record_id as "recordId", record_version as "recordVersion", signed_at as "signedAt" FROM signature_artifacts
       WHERE record_id = $1 AND record_version = $2`,
      [row.record_id, row.record_version]
    )).rows[0];

    res.status(201).json(artifact);
  }
);

// GET /api/signatures/artifacts — QMS fetches by recordId/recordVersion (no auth for QMS integration; optional API key in real use)
router.get('/artifacts', async (req, res) => {
  const recordId = req.query.recordId as string | undefined;
  const recordVersion = req.query.recordVersion as string | undefined;
  if (!recordId) {
    return res.status(400).json({ error: 'recordId required' });
  }
  const version = recordVersion ? parseInt(recordVersion, 10) : 1;

  const rows = (await query(
    `SELECT id, algorithm, signature, payload_canonical as "payloadCanonical", qms_hash as "qmsHash",
            record_type as "recordType", record_id as "recordId", record_version as "recordVersion",
            approval_type as "approvalType", signed_at as "signedAt", signed_by as "signedBy", public_key_id as "publicKeyId"
     FROM signature_artifacts WHERE record_id = $1 AND record_version = $2`,
    [recordId, version]
  )).rows;

  res.json({ artifacts: rows });
});

// GET /api/signatures/artifacts/by-hash — fetch by qmsHash
router.get('/artifacts/by-hash', async (req, res) => {
  const qmsHash = req.query.qmsHash as string | undefined;
  if (!qmsHash) return res.status(400).json({ error: 'qmsHash required' });

  const rows = (await query(
    `SELECT id, algorithm, signature, payload_canonical as "payloadCanonical", qms_hash as "qmsHash",
            record_type as "recordType", record_id as "recordId", record_version as "recordVersion",
            approval_type as "approvalType", signed_at as "signedAt", signed_by as "signedBy", public_key_id as "publicKeyId"
     FROM signature_artifacts WHERE qms_hash = $1`,
    [qmsHash]
  )).rows;

  res.json({ artifacts: rows });
});

// GET /api/signatures/status — check if signing is configured
router.get('/status', async (_req, res) => {
  res.json({ configured: isSigningConfigured() });
});

export default router;
