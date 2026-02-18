-- Cryptographic approval signatures (Ed25519)
-- QMS can verify without changing its hashing

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type VARCHAR(50) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  record_version INTEGER NOT NULL DEFAULT 1,
  qms_hash VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  approval_type VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SIGNED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(record_type, record_id, record_version)
);

CREATE TABLE IF NOT EXISTS signature_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  algorithm VARCHAR(20) NOT NULL DEFAULT 'ED25519',
  signature TEXT NOT NULL,
  payload_canonical TEXT NOT NULL,
  qms_hash VARCHAR(255) NOT NULL,
  record_type VARCHAR(50) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  record_version INTEGER NOT NULL,
  approval_type VARCHAR(50),
  signed_at TIMESTAMPTZ NOT NULL,
  signed_by VARCHAR(255) NOT NULL,
  public_key_id VARCHAR(255) NOT NULL,
  client_ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_artifacts_record ON signature_artifacts(record_id, record_version);
CREATE INDEX IF NOT EXISTS idx_signature_artifacts_qms_hash ON signature_artifacts(qms_hash);
