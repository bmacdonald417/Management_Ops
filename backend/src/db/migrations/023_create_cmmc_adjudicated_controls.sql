-- CMMC Live Status Dashboard: adjudicated control status from evidence bundle manifest
CREATE TABLE IF NOT EXISTS cmmc_adjudicated_controls (
    id SERIAL PRIMARY KEY,
    control_id TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    status TEXT NOT NULL,
    class TEXT,
    last_seen_ingest_id INTEGER NOT NULL REFERENCES cmmc_evidence_ingest_log(id)
);

CREATE INDEX IF NOT EXISTS idx_cmmc_adjudicated_domain ON cmmc_adjudicated_controls(domain);
CREATE INDEX IF NOT EXISTS idx_cmmc_adjudicated_status ON cmmc_adjudicated_controls(status);
