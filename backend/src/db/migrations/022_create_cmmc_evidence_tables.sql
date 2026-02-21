-- CMMC Evidence Ingestor: ingest log and control evidence from Trust Codex bundle
CREATE TABLE IF NOT EXISTS cmmc_evidence_ingest_log (
    id SERIAL PRIMARY KEY,
    ingest_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL,
    bundle_version TEXT,
    trust_codex_version TEXT,
    bundle_hash TEXT,
    ingested_by_user_id UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cmmc_control_evidence (
    id SERIAL PRIMARY KEY,
    control_id TEXT NOT NULL,
    status TEXT NOT NULL,
    evidence_filename TEXT NOT NULL,
    evidence_sha256 TEXT NOT NULL,
    last_seen_ingest_id INTEGER NOT NULL REFERENCES cmmc_evidence_ingest_log(id)
);

CREATE INDEX IF NOT EXISTS idx_cmmc_evidence_ingest_timestamp ON cmmc_evidence_ingest_log(ingest_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cmmc_control_evidence_control ON cmmc_control_evidence(control_id);
