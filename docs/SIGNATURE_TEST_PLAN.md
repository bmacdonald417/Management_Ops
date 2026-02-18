# Cryptographic Signature Test Plan

## Env Vars

Add to `.env`:

```env
# Ed25519 private key (PEM format, single line with \n escaped, or multi-line)
GOV_ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEI...
-----END PRIVATE KEY-----"
GOV_ED25519_PUBLIC_KEY_ID=gov-1
```

Generate keys:
```bash
cd backend && npx tsx src/scripts/generateEd25519Key.ts
```

## File Changes Summary

| File | Change |
|------|--------|
| `backend/src/db/migrations/013_signature_artifacts.sql` | New: signature_requests, signature_artifacts tables |
| `backend/src/services/signatureService.ts` | New: canonical payload, Ed25519 sign/verify |
| `backend/src/routes/signatures.ts` | New: list requests, create, sign, fetch artifacts |
| `backend/src/index.ts` | Mount `/api/signatures` |
| `backend/.env.example` | Add GOV_ED25519_* vars |
| `frontend/src/pages/GovernanceSignatureRequests.tsx` | New: Signature Requests page |
| `frontend/src/App.tsx` | Route `/governance-engine/signature-requests` |
| `frontend/src/components/Layout.tsx` | Nav: Signature Requests |
| `backend/src/scripts/generateEd25519Key.ts` | New: key generation script |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/signatures/requests | Yes | List pending signature requests |
| POST | /api/signatures/requests | Yes | Create signature request |
| POST | /api/signatures/requests/:id/sign | Yes | Sign and create artifact |
| GET | /api/signatures/artifacts?recordId=&recordVersion= | No | QMS: fetch artifacts by record |
| GET | /api/signatures/artifacts/by-hash?qmsHash= | No | QMS: fetch by qmsHash |
| GET | /api/signatures/status | No | Check if signing configured |

## Canonical Payload (MAC-FRM-013 compatible)

```json
{
  "approvalType": "CLAUSE_ASSESSMENT",
  "controlTags": ["governance", "clause-assessment"],
  "qmsHash": "<from QMS>",
  "recordId": "<qms form record id>",
  "recordType": "CLAUSE_ASSESSMENT",
  "recordVersion": 1,
  "signedAt": "2025-02-13T12:00:00.000Z",
  "signedBy": "user@example.com"
}
```

Keys are in sorted order. Dates ISO8601 UTC. controlTags sorted.

## Signature Artifact Stored

- algorithm: ED25519
- signature: base64
- payloadCanonical: exact string signed
- qmsHash, recordType, recordId, recordVersion
- approvalType, signedAt, signedBy, publicKeyId
- client_ip, user_agent (audit metadata)

## Test Plan

### 1. Generate Key
```bash
cd backend && npx tsx src/scripts/generateEd25519Key.ts
```
Copy private key to .env.

### 2. Run Migration
```bash
npm run db:migrate
```

### 3. Create Signature Request
- Go to Governance → Signature Requests
- Click "Add Request"
- Fill: recordType=CLAUSE_ASSESSMENT, recordId=test-001, recordVersion=1, qmsHash=abc123, title=Test
- Submit

### 4. Sign
- Click "Sign" on the pending row
- Verify no error; row disappears from list

### 5. Fetch Artifact (QMS simulation)
```bash
curl "http://localhost:3000/api/signatures/artifacts?recordId=test-001&recordVersion=1"
```
Expect `{ artifacts: [...] }` with signature, payloadCanonical, etc.

### 6. Verify (Node)
```js
const crypto = require('crypto');
const artifact = { payloadCanonical, signature }; // from API
const publicKey = crypto.createPublicKey('<PUBLIC_KEY_PEM>');
const ok = crypto.verify(null, Buffer.from(artifact.payloadCanonical, 'utf8'), publicKey, Buffer.from(artifact.signature, 'base64'));
// ok === true
```

### 7. Status Check
```bash
curl http://localhost:3000/api/signatures/status
# { configured: true }
```
