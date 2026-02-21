/**
 * CMMC Evidence Ingestor: process Trust Codex evidence-bundle.zip
 * Supports: (1) manifest.json with controls array, (2) manifest.json with evidence array, (3) qms-manifest.json
 * Verifies manifest hash and evidence file hashes; updates cmmc_control_evidence and cmmc_adjudicated_controls.
 */
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import { pool } from '../db/connection.js';

/** CMMC control ID prefix -> domain name */
const CMMC_DOMAIN_MAP: Record<string, string> = {
  AC: 'Access Control',
  AM: 'Asset Management',
  AT: 'Awareness and Training',
  AU: 'Audit and Accountability',
  CA: 'Security Assessment',
  CM: 'Configuration Management',
  IA: 'Identification and Authentication',
  IR: 'Incident Response',
  MA: 'Maintenance',
  MP: 'Media Protection',
  PE: 'Physical Protection',
  PS: 'Personnel Security',
  RA: 'Risk Assessment',
  RM: 'Risk Management',
  SA: 'Situational Awareness',
  SC: 'System and Communications Protection',
  SI: 'System and Information Integrity'
};

function controlIdToDomain(controlId: string): string {
  const prefix = controlId.split(/[.\-]/)[0]?.toUpperCase() ?? '';
  return CMMC_DOMAIN_MAP[prefix] ?? 'Other';
}

function normalizeStatus(s: string): string {
  const lower = (s || '').toLowerCase();
  // Handle all five status types from the evidence bundle
  if (lower === 'implemented') return 'implemented';
  if (lower === 'partially_implemented' || lower === 'partial') return 'partially_implemented';
  if (lower === 'governed') return 'governed';
  if (lower === 'inherited') return 'inherited';
  if (lower === 'not_applicable' || lower === 'not applicable' || lower === 'n/a') return 'not_applicable';
  // Fallback for legacy formats
  if (lower.includes('implement') && !lower.includes('partial')) return 'implemented';
  if (lower.includes('partial')) return 'partially_implemented';
  return 'not_implemented';
}

export interface ManifestEvidence {
  controlId: string;
  status: string;
  filename: string;
  sha256: string;
}

export interface Manifest {
  bundleHash: string;
  bundleVersion?: string;
  createdAt?: string;
  trustCodexVersion?: string;
  evidence?: ManifestEvidence[];
  controls?: ManifestControl[];
}

/** manifest.json controls array format (dashboard/adjudication) */
export interface ManifestControl {
  control_id: string;
  status: string;
  class?: string;
  evidence?: unknown[];
}

/** Trust Codex QMS export manifest format */
interface QmsManifestDoc {
  code: string;
  title?: string;
  kind?: string;
  filename_in_zip: string;
  content_sha256?: string;
  file_sha256: string;
}

interface QmsManifest {
  generated_utc?: string;
  attestation_file?: string;
  digest_sha256: string;
  documents: QmsManifestDoc[];
}

/**
 * Canonical JSON stringify matching Trust Codex's exact method
 * Trust Codex uses JSON.stringify(copy) directly - no key sorting, just compact JSON
 * This preserves the original key order from the manifest object
 */
function canonicalStringify(obj: unknown): string {
  // Trust Codex uses JSON.stringify directly without any key sorting
  // This preserves the key order as it appears in the original object
  return JSON.stringify(obj);
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

type ParsedManifest = {
  evidence: ManifestEvidence[];
  controls?: ManifestControl[];
  bundleHash: string;
  bundleVersion: string | null;
  trustCodexVersion: string | null;
};

function parseManifest(zip: AdmZip): ParsedManifest {
  const manifestEntry = zip.getEntry('manifest.json');
  if (manifestEntry && !manifestEntry.isDirectory) {
    const manifestRaw = manifestEntry.getData().toString('utf8');
    const manifest = JSON.parse(manifestRaw) as Manifest;
    if (!manifest.bundleHash) throw new Error('manifest.json requires bundleHash');

    // Create a copy without bundleHash for verification
    const manifestWithoutHash: Record<string, unknown> = { ...manifest };
    delete manifestWithoutHash.bundleHash;
    
    // Compute canonical JSON and hash
    const canonical = canonicalStringify(manifestWithoutHash);
    const computed = sha256Hex(canonical);
    const expected = (manifest.bundleHash || '').toLowerCase();
    
    // Allow bypassing hash check via environment variable for testing
    const skipHashCheck = process.env.SKIP_MANIFEST_HASH_CHECK === 'true';
    
    if (!skipHashCheck && computed.toLowerCase() !== expected) {
      // Log for debugging
      console.error('[Ingest] Hash mismatch:', {
        computed,
        expected,
        canonicalLength: canonical.length,
        canonicalPreview: canonical.substring(0, 200),
        manifestKeys: Object.keys(manifestWithoutHash).sort()
      });
      throw new Error(`Manifest hash mismatch: computed ${computed.substring(0, 16)}... expected ${expected.substring(0, 16)}...`);
    }
    
    if (skipHashCheck) {
      console.warn('[Ingest] ⚠️  Hash verification bypassed (SKIP_MANIFEST_HASH_CHECK=true)');
    }

    // Format 1: controls array (dashboard/adjudication)
    if (Array.isArray(manifest.controls) && manifest.controls.length > 0) {
      const evidence: ManifestEvidence[] = [];
      for (const c of manifest.controls) {
        const evList = (c.evidence ?? []) as { filename?: string; sha256?: string }[];
        for (const ev of evList) {
          if (ev.filename && ev.sha256) {
            evidence.push({
              controlId: c.control_id,
              status: c.status,
              filename: ev.filename,
              sha256: ev.sha256
            });
          }
        }
      }
      return {
        evidence,
        controls: manifest.controls,
        bundleHash: manifest.bundleHash,
        bundleVersion: manifest.bundleVersion ?? null,
        trustCodexVersion: manifest.trustCodexVersion ?? null
      };
    }

    // Format 2: evidence array (legacy)
    if (Array.isArray(manifest.evidence)) {
      return {
        evidence: manifest.evidence,
        bundleHash: manifest.bundleHash,
        bundleVersion: manifest.bundleVersion ?? null,
        trustCodexVersion: manifest.trustCodexVersion ?? null
      };
    }
  }

  const qmsEntry = zip.getEntry('qms-manifest.json');
  if (qmsEntry && !qmsEntry.isDirectory) {
    const qmsRaw = qmsEntry.getData().toString('utf8');
    const qms = JSON.parse(qmsRaw) as QmsManifest;
    if (!qms.digest_sha256 || !Array.isArray(qms.documents)) {
      throw new Error('Invalid QMS manifest: digest_sha256 and documents array required');
    }
    // digest_sha256 is the hash of the attestation file; find it (e.g. codex-attestations-*.md)
    const entries = zip.getEntries();
    const attestEntry = entries.find(
      (e) =>
        !e.isDirectory &&
        (e.entryName === qms.attestation_file ||
          /codex-attestations[^/]*\.md$/i.test(e.entryName))
    );
    if (attestEntry) {
      const attestData = attestEntry.getData();
      const attestHash = sha256Hex(Buffer.isBuffer(attestData) ? attestData : Buffer.from(attestData));
      if (attestHash.toLowerCase() !== (qms.digest_sha256 || '').toLowerCase()) {
        throw new Error('QMS attestation digest mismatch');
      }
    }
    const evidence: ManifestEvidence[] = qms.documents.map((d) => ({
      controlId: d.code,
      status: 'implemented',
      filename: d.filename_in_zip,
      sha256: d.file_sha256
    }));
    return {
      evidence,
      bundleHash: qms.digest_sha256,
      bundleVersion: qms.generated_utc ?? null,
      trustCodexVersion: 'QMS'
    };
  }

  throw new Error('manifest.json or qms-manifest.json not found in bundle');
}

function evidenceToAdjudicated(evidence: ManifestEvidence[], ingestId: number): { control_id: string; domain: string; status: string; class: string | null }[] {
  const byControl = new Map<string, { status: string; class: string | null }>();
  for (const ev of evidence) {
    const existing = byControl.get(ev.controlId);
    const norm = normalizeStatus(ev.status);
    // Prefer implemented over partial, but keep existing if it's already implemented
    if (!existing || (norm === 'implemented' && existing.status !== 'implemented')) {
      byControl.set(ev.controlId, { status: norm, class: null });
    }
  }
  return Array.from(byControl.entries()).map(([control_id, { status }]) => ({
    control_id,
    domain: controlIdToDomain(control_id),
    status,
    class: null as string | null
  }));
}

export async function processEvidenceBundle(fileBuffer: Buffer, userId: string): Promise<{ ingestId: number }> {
  const client = await pool.connect();
  let ingestId: number;

  try {
    const logRes = await client.query(
      `INSERT INTO cmmc_evidence_ingest_log (status, ingested_by_user_id) VALUES ('PENDING', $1) RETURNING id`,
      [userId]
    );
    ingestId = logRes.rows[0].id as number;

    const zip = new AdmZip(fileBuffer);
    let parsed: ParsedManifest;
    try {
      parsed = parseManifest(zip);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid manifest';
      await client.query(`UPDATE cmmc_evidence_ingest_log SET status = $1 WHERE id = $2`, [`FAILURE: ${msg}`, ingestId]);
      throw err;
    }

    const { evidence } = parsed;

    for (const ev of evidence) {
      const entry = zip.getEntry(ev.filename);
      if (!entry || entry.isDirectory) {
        await client.query(`UPDATE cmmc_evidence_ingest_log SET status = $1 WHERE id = $2`, [
          `FAILURE: Evidence file not found: ${ev.filename}`,
          ingestId
        ]);
        throw new Error(`Evidence file not found: ${ev.filename}`);
      }
      const data = entry.getData();
      const fileHash = sha256Hex(Buffer.isBuffer(data) ? data : Buffer.from(data));
      if (fileHash.toLowerCase() !== (ev.sha256 || '').toLowerCase()) {
        await client.query(`UPDATE cmmc_evidence_ingest_log SET status = $1 WHERE id = $2`, [
          `FAILURE: Evidence hash mismatch for ${ev.filename}`,
          ingestId
        ]);
        throw new Error(`Evidence hash mismatch for ${ev.filename}`);
      }
    }

    const adjudicated =
      parsed.controls?.map((c) => ({
        control_id: c.control_id,
        domain: controlIdToDomain(c.control_id),
        status: normalizeStatus(c.status),
        class: c.class ?? null,
        evidence_count: (c.evidence ?? []).length
      })) ?? evidenceToAdjudicated(evidence, ingestId).map((adj) => ({ ...adj, evidence_count: 0 }));

    await client.query('BEGIN');
    // Clear old data
    await client.query('DELETE FROM cmmc_control_evidence_files');
    await client.query('DELETE FROM cmmc_adjudicated_controls');
    await client.query('DELETE FROM cmmc_control_evidence');
    
    // Insert adjudicated controls with evidence file counts
    for (const adj of adjudicated) {
      await client.query(
        `INSERT INTO cmmc_adjudicated_controls (control_id, domain, status, class, evidence_file_count, last_seen_ingest_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (control_id) DO UPDATE SET 
           domain = EXCLUDED.domain, 
           status = EXCLUDED.status, 
           class = EXCLUDED.class, 
           evidence_file_count = EXCLUDED.evidence_file_count,
           last_seen_ingest_id = EXCLUDED.last_seen_ingest_id,
           updated_at = NOW()`,
        [adj.control_id, adj.domain, adj.status, adj.class, adj.evidence_count, ingestId]
      );
    }
    
    // Insert evidence files from controls array
    if (parsed.controls) {
      for (const c of parsed.controls) {
        const evList = (c.evidence ?? []) as { filename?: string; sha256?: string }[];
        for (const ev of evList) {
          if (ev.filename) {
            await client.query(
              `INSERT INTO cmmc_control_evidence_files (control_id, filename, sha256, last_seen_ingest_id)
               VALUES ($1, $2, $3, $4)`,
              [c.control_id, ev.filename, ev.sha256 ?? null, ingestId]
            );
          }
        }
      }
    }
    
    // Also insert into legacy cmmc_control_evidence table for backward compatibility
    for (const ev of evidence) {
      await client.query(
        `INSERT INTO cmmc_control_evidence (control_id, status, evidence_filename, evidence_sha256, last_seen_ingest_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [ev.controlId, ev.status, ev.filename, ev.sha256, ingestId]
      );
    }
    await client.query(
      `UPDATE cmmc_evidence_ingest_log SET status = 'SUCCESS', bundle_version = $1, trust_codex_version = $2, bundle_hash = $3 WHERE id = $4`,
      [parsed.bundleVersion, parsed.trustCodexVersion, parsed.bundleHash, ingestId]
    );
    await client.query('COMMIT');

    return { ingestId };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
