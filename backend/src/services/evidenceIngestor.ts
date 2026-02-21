/**
 * CMMC Evidence Ingestor: process Trust Codex evidence-bundle.zip
 * Supports: (1) manifest.json (evidence bundle), (2) qms-manifest.json (Trust Codex QMS export)
 * Verifies manifest hash and evidence file hashes; updates cmmc_control_evidence.
 */
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import { pool } from '../db/connection.js';

export interface ManifestEvidence {
  controlId: string;
  status: string;
  filename: string;
  sha256: string;
}

export interface Manifest {
  bundleHash: string;
  bundleVersion?: string;
  trustCodexVersion?: string;
  evidence: ManifestEvidence[];
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

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + sorted.map((k) => JSON.stringify(k) + ':' + canonicalStringify((obj as Record<string, unknown>)[k])).join(',') + '}';
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function parseManifest(zip: AdmZip): {
  evidence: ManifestEvidence[];
  bundleHash: string;
  bundleVersion: string | null;
  trustCodexVersion: string | null;
} {
  const manifestEntry = zip.getEntry('manifest.json');
  if (manifestEntry && !manifestEntry.isDirectory) {
    const manifestRaw = manifestEntry.getData().toString('utf8');
    const manifest = JSON.parse(manifestRaw) as Manifest;
    if (manifest.bundleHash && Array.isArray(manifest.evidence)) {
      const manifestWithoutHash = { ...manifest };
      delete (manifestWithoutHash as Record<string, unknown>).bundleHash;
      const canonical = canonicalStringify(manifestWithoutHash);
      const computed = sha256Hex(canonical);
      if (computed.toLowerCase() !== (manifest.bundleHash || '').toLowerCase()) {
        throw new Error('Manifest hash mismatch');
      }
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
    let parsed: { evidence: ManifestEvidence[]; bundleHash: string; bundleVersion: string | null; trustCodexVersion: string | null };
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

    await client.query('BEGIN');
    await client.query('DELETE FROM cmmc_control_evidence');
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
