# MacTech Governance Platform — Complete System Architecture

> Full-stack architecture document. Covers backend, frontend, database, integrations, and data flows.

---

## 1. Executive Overview

The **MacTech Governance Platform** is a compliance and pre-bid governance system for government contracting. It supports:

- **Solicitation management** — Intake, clause extraction, risk assessment, approvals, and approve-to-bid
- **Clause library** — FAR/DFARS clauses with overlays, search, and manual add
- **Risk scoring** — Config-driven multi-factor assessment (financial, cyber, flowdown, etc.)
- **QMS integration** — Persist clause assessments as form records (DRAFT/FINAL)
- **Cryptographic approvals** — Ed25519 signing of approval envelopes for QMS verification
- **Compliance registry** — Import and manage regulatory data (clauses, controls, templates)
- **RAG / Copilot** — Embeddings, retrieval, and AI-assisted clause enrichment
- **Governance maturity** — GCI scoring, completeness index, auto-builder

---

## 2. Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, React Router 6, Vite, Tailwind CSS, Axios |
| **Backend** | Node.js, Express 4, TypeScript, ESM |
| **Database** | PostgreSQL |
| **Auth** | JWT (Bearer token), role-based access |
| **AI** | OpenAI API (chat, embeddings) |
| **Build** | TypeScript compiler, Vite (frontend) |
| **Deployment** | Railway (prod boot: migrate → optional ingest → API) |

### Key Dependencies

- **Backend**: express, cors, pg, jsonwebtoken, zod, cheerio, openai, multer, uuid, dotenv
- **Frontend**: react, react-router-dom, axios, react-markdown

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (SPA)                                       │
│  React + Vite + Tailwind | AuthContext | Axios → /api                            │
└─────────────────────────────────────────────┬───────────────────────────────────┘
                                              │ HTTPS
┌─────────────────────────────────────────────▼───────────────────────────────────┐
│                         EXPRESS API (Node.js)                                    │
│  /api/auth | /api/solicitations | /api/signatures | /api/copilot | ...           │
│  Middleware: auth, audit, CORS, JSON                                            │
└─────────────────────────────────────────────┬───────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────────────────┐
│   PostgreSQL  │   │  OpenAI API    │   │  QMS API     │   │  Regulatory HTML   │
│   (primary)   │   │  (embeddings,  │   │  (MAC-FRM-   │   │  (FAR/DFARS)       │
│               │   │   chat)        │   │   013 forms) │   │  ingested          │
└───────────────┘   └────────────────┘   └──────────────┘   └────────────────────┘
```

---

## 4. Directory Structure

### Backend

```
backend/
├── src/
│   ├── db/
│   │   ├── connection.ts
│   │   ├── migrate.ts
│   │   ├── schema.sql
│   │   ├── migrations/          # 001..013
│   │   └── seeds/               # 01..06
│   ├── lib/
│   │   └── openaiClient.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── audit.ts
│   ├── routes/
│   │   ├── admin.ts
│   │   ├── ai.ts
│   │   ├── auth.ts
│   │   ├── clauseLibrary.ts
│   │   ├── compliance.ts
│   │   ├── complianceKB.ts
│   │   ├── completeness.ts
│   │   ├── contracts.ts
│   │   ├── copilot.ts
│   │   ├── cyber.ts
│   │   ├── dashboard.ts
│   │   ├── financials.ts
│   │   ├── governance.ts
│   │   ├── risk.ts
│   │   ├── solicitationClauses.ts
│   │   ├── solicitationEngine.ts
│   │   ├── signatures.ts
│   │   └── users.ts
│   ├── scripts/
│   │   ├── copyRegulatory.ts
│   │   ├── generateEd25519Key.ts
│   │   ├── ingestRegulations.ts
│   │   ├── prodBoot.ts
│   │   ├── regVerify.ts
│   │   ├── seedGovernanceEngineDemo.ts
│   │   └── seedClauseOverlayAcceptance.ts
│   ├── services/
│   │   ├── autoBuilder/         # context, generate, maturityBridge, sectionRegistry
│   │   ├── clauseAssessmentFormBuilder.ts
│   │   ├── clauseExtractor.ts
│   │   ├── clauseRiskEngine.ts
│   │   ├── clauseService.ts     # canonical clause reads, overlays
│   │   ├── complianceKB/        # chunk, embeddings, ingest, retrieve, stats, types
│   │   ├── complianceRegistry/  # ingestion, registryStats, types, validation, versionControl
│   │   ├── copilot/modes.ts
│   │   ├── governanceMaturity.ts
│   │   ├── governanceScoring.ts
│   │   ├── qmsClient.ts
│   │   ├── regulatoryParser.ts
│   │   ├── signatureService.ts
│   │   ├── solicitationRiskEngine.ts
│   │   └── workflowEngine.ts    # approve-to-bid blockers, risk log
│   └── index.ts
├── regulatory/                  # HTML sources (part_52, part252)
└── dist/                        # Build output
```

### Frontend

```
frontend/
├── src/
│   ├── api/client.ts            # Axios instance, JWT interceptor
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── governance/
│   │       ├── CopilotDrawer.tsx
│   │       ├── EscalationPill.tsx
│   │       ├── MaturityBanner.tsx
│   │       ├── RiskBadge.tsx
│   │       ├── SectionCard.tsx
│   │       └── Stepper.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   └── pages/
│       ├── Dashboard.tsx, Login.tsx
│       ├── Contracts.tsx, ContractDetail.tsx
│       ├── Compliance.tsx
│       ├── Financials.tsx, Cyber.tsx
│       ├── GovernanceEngine.tsx
│       ├── GovernanceSolicitations.tsx, GovernanceSolicitationEngineDetail.tsx
│       ├── GovernanceSolicitationEngineNew.tsx, GovernanceSolicitationNew.tsx
│       ├── GovernanceSolicitationReview.tsx
│       ├── GovernanceClauseAssess.tsx, GovernanceClauseApprove.tsx
│       ├── GovernanceClauseLibrary.tsx
│       ├── GovernanceSignatureRequests.tsx
│       ├── GovernanceReports.tsx, GovernanceAuditTrail.tsx
│       ├── GovernancePacketExport.tsx
│       ├── GovernanceMaturity.tsx, GovernanceCopilot.tsx
│       ├── GovernanceAutoBuilder*.tsx (Manual, Evidence, Appendices)
│       ├── AdminComplianceRegistry.tsx
│       ├── AdminRegulatoryLibrary.tsx
│       └── AdminAISettings.tsx
└── dist/
```

---

## 5. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| users | Auth, roles (Level 1..4) |
| audit_logs | General audit trail |
| contracts | Contract metadata |
| risk_profiles | Contract risk profiles |
| compliance_clauses | Legacy contract clause link |
| contract_clauses | Contract ↔ clause link |
| cmmc_controls, cmmc_assessments | Cyber controls |
| documents, notifications, risk_escalations, incident_reports | Supporting |

### Governance Engine

| Table | Purpose |
|-------|---------|
| solicitations | Pre-bid solicitation header |
| solicitation_versions | Legacy versioning |
| solicitation_clauses | Engine: solicitation ↔ regulatory_clause link |
| clause_risk_assessments | Per-clause risk (base/assessed/effective), flowdown |
| clause_review_tasks | Task assignment (underused) |
| clause_risk_log_snapshots | Generated risk log PDF data |
| approvals | Approval records |
| governance_audit_events | Engine audit trail |
| governance_metric_snapshots | GCI snapshots |
| governance_completeness_index | Completeness per solicitation |
| risk_model_config | Score thresholds (L2/L3/L4) |

### Clause Sources

| Table | Purpose |
|-------|---------|
| regulatory_clauses | FAR/DFARS ingested; canonical for engine |
| clause_library_items | Quality overlays (override risk, tags, notes) |
| clause_master | Compliance registry import staging |
| compliance_clauses | Legacy contract use only |

### QMS & Signatures

| Table | Purpose |
|-------|---------|
| clause_assessment_form_links | Link clause_risk_assessment ↔ QMS form record |
| signature_requests | Pending/signed signature requests |
| signature_artifacts | Ed25519 signature, canonical payload, QMS hash |

### Compliance Registry & KB

| Table | Purpose |
|-------|---------|
| compliance_data_sources | Import sources |
| compliance_registry_errors | Import errors |
| clause_master, cyber_control_master, cost_accounts, insurance_tiers, indemnification_templates | Registry data |
| compliance_documents, compliance_chunks | RAG documents + embeddings |
| copilot_runs | Copilot run history |

### Entity Relationship (Simplified)

```
users
  ├── solicitations (owner_id, no_clauses_attested_by)
  ├── approvals
  ├── governance_audit_events (actor_id)
  ├── clause_risk_assessments (assessed_by, approved_by)
  └── copilot_runs (actor_id)

solicitations
  ├── solicitation_clauses (solicitation_id)
  │     └── regulatory_clauses (clause_id)
  │     └── clause_risk_assessments (solicitation_clause_id)
  │           └── clause_assessment_form_links (clause_risk_assessment_id)
  ├── clause_risk_log_snapshots
  ├── approvals
  └── governance_completeness_index

regulatory_clauses ← clause_library_items (overlay by clause_number)
compliance_data_sources → clause_master, cyber_control_master, ...
compliance_documents → compliance_chunks
signature_requests → signature_artifacts (record_type, record_id, record_version)
```

---

## 6. API Routes

### Auth & Users

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/dev-token | Dev token (when enabled) |
| GET | /api/users | List users |
| GET | /api/users/:id | Get user |
| PUT | /api/users/:id | Update user |

### Solicitation Engine (Primary Pre-Bid Flow)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/solicitations/clause-library | Search clauses for manual add |
| GET | /api/solicitations | List solicitations |
| POST | /api/solicitations | Create solicitation |
| GET | /api/solicitations/:id | Get detail |
| PATCH | /api/solicitations/:id | Update |
| POST | /api/solicitations/:id/clauses/extract | Extract clauses from text |
| POST | /api/solicitations/:id/clauses/manual | Add clause manually |
| DELETE | /api/solicitations/:id/clauses/:scId | Remove clause |
| GET | /api/solicitations/:id/approve-to-bid/blockers | Workflow blockers |
| POST | /api/solicitations/:id/approve-to-bid | Approve to bid (when no blockers) |
| POST | /api/solicitations/:id/risk-log/generate | Generate risk log snapshot |
| GET | /api/solicitations/:id/risk-log/latest | Get latest risk log |
| GET | /api/solicitations/:id/completeness | Completeness index |
| POST | /api/solicitations/:id/form-record/save-draft | Save QMS draft |
| POST | /api/solicitations/:id/form-record/finalize | Finalize QMS record |
| GET | /api/solicitations/:id/form-record | Get form record for clause |
| GET | /api/solicitations/:id/form-records | List form records |

### Solicitation Clauses (Assessment & Approval)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/solicitation-clauses/:id/assess | Submit risk assessment |
| POST | /api/solicitation-clauses/:id/approve | Approve / reject assessment |

### Signatures (Ed25519)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/signatures/requests | List signature requests |
| POST | /api/signatures/requests | Create request |
| POST | /api/signatures/requests/:id/sign | Sign request |
| GET | /api/signatures/artifacts | Fetch by recordId + recordVersion |
| GET | /api/signatures/artifacts/by-hash | Fetch by qmsHash (QMS verification) |

### Other Modules

| Module | Base Path | Key Routes |
|--------|-----------|------------|
| Contracts | /api/contracts | CRUD, clauses |
| Compliance | /api/compliance | Contract clauses, library, retrieve |
| Clause Library | /api/compliance | /library, /library/search, /library/by-number/:n |
| Compliance KB | /api/compliance | POST /retrieve (RAG) |
| Financials | /api/financials | Rates, costs |
| Risk | /api/risk | Profiles, escalations |
| Cyber | /api/cyber | CMMC, incidents |
| Governance | /api/governance | Config, solicitations (legacy), clause-library, reports, maturity, auto-builder |
| Completeness | /api/completeness | GET /org |
| Admin | /api/admin | Registry sources, upload, KB sync, regulatory clauses |
| AI | /api/ai | Status, chat |
| Copilot | /api/copilot | POST /run (modes: CLAUSE_ENRICH, etc.) |
| Dashboard | /api/dashboard | KPIs |

---

## 7. Frontend Routing

| Path | Component | Description |
|------|-----------|-------------|
| / | Dashboard | Main dashboard |
| /login | Login | Auth |
| /contracts | Contracts | Contract list |
| /contracts/:id | ContractDetail | Contract detail |
| /compliance | Compliance | Compliance overview |
| /financials | Financials | Financial rates/costs |
| /cyber | Cyber | CMMC, incidents |
| /governance-engine | GovernanceEngine | Pre-bid dashboard |
| /governance-engine/solicitations | GovernanceSolicitations | Solicitation list |
| /governance-engine/solicitations/new | GovernanceSolicitationNew | Legacy new |
| /governance-engine/solicitations/engine/new | GovernanceSolicitationEngineNew | Engine new |
| /governance-engine/solicitations/:id | GovernanceSolicitationReview | Legacy review |
| /governance-engine/solicitations/:id/engine | GovernanceSolicitationEngineDetail | Engine detail (stepper) |
| /governance-engine/solicitations/:id/engine/assess/:scId | GovernanceClauseAssess | Clause assessment + Copilot |
| /governance-engine/solicitations/:id/engine/approve/:scId | GovernanceClauseApprove | Approve assessment |
| /governance-engine/clause-library | GovernanceClauseLibrary | Clause library |
| /governance-engine/signature-requests | GovernanceSignatureRequests | Ed25519 signatures |
| /governance-engine/maturity | GovernanceMaturity | Maturity view |
| /governance-engine/auto-builder | GovernanceAutoBuilder | Auto-builder |
| /governance-engine/copilot | GovernanceCopilot | Copilot |
| /governance-engine/reports | GovernanceReports | Reports |
| /governance-engine/solicitations/:id/audit | GovernanceAuditTrail | Audit |
| /governance-engine/solicitations/:id/export | GovernancePacketExport | Packet export |
| /admin/compliance-registry | AdminComplianceRegistry | Registry admin |
| /admin/regulatory-library | AdminRegulatoryLibrary | Regulatory library |
| /admin/ai-settings | AdminAISettings | AI config |

---

## 8. Key Data Flows

### Pre-Bid Solicitation Engine Flow

```
1. CREATE solicitation (POST /api/solicitations)
2. CLAUSE EXTRACTION (paste text → POST /api/solicitations/:id/clauses/extract)
   OR MANUAL ADD (from clause library → POST /api/solicitations/:id/clauses/manual)
3. CLAUSE ASSESSMENT (per clause → POST /api/solicitation-clauses/:id/assess)
   - Uses clauseService.getClauseWithOverlay for base values
   - Uses solicitationRiskEngine.assessClauseRisk for scoring
   - Optional: Copilot CLAUSE_ENRICH → Apply to Form
4. APPROVAL (per L3/L4 clause → POST /api/solicitation-clauses/:id/approve)
5. APPROVE TO BID
   - GET /api/solicitations/:id/approve-to-bid/blockers
   - If canApprove: POST /api/solicitations/:id/approve-to-bid
6. RISK LOG
   - POST /api/solicitations/:id/risk-log/generate
   - GET /api/solicitations/:id/risk-log/latest
```

### Workflow Gates (workflowEngine)

Blockers checked before approve-to-bid:

- `NO_CLAUSES` — At least one clause required
- `UNASSESSED_CLAUSES` — All clauses need approved assessment
- `FLOWDOWN_REVIEW_PENDING` — Flow-down required clauses need flowdown review
- `QUALITY_APPROVAL_REQUIRED` — L3/L4 require Quality approval
- `RISK_LOG_STALE` — Risk log must be generated within 7 days

### QMS Integration Flow

```
1. Save Draft: POST /api/solicitations/:id/form-record/save-draft
   - Builds MAC-FRM-013 payload via clauseAssessmentFormBuilder
   - qmsClient.createFormRecord (QMS API)
   - Inserts clause_assessment_form_links (status DRAFT)
2. Finalize: POST /api/solicitations/:id/form-record/finalize
   - qmsClient.finalizeFormRecord
   - Updates link status to FINAL
3. QMS can verify: GET /api/signatures/artifacts/by-hash?qmsHash=...
```

### Cryptographic Signatures Flow

```
1. Create request: POST /api/signatures/requests
   - Body: recordType, recordId, recordVersion, qmsHash, title
2. Sign: POST /api/signatures/requests/:id/sign
   - Builds canonical payload (approvalType, controlTags, qmsHash, recordId, ...)
   - Ed25519 sign via signatureService.signCanonical
   - Inserts signature_artifacts
3. QMS verification: GET /api/signatures/artifacts?recordId=&recordVersion=
   - Returns signature + payload_canonical for verification
```

### Clause Service (Canonical Read)

- **Source**: `regulatory_clauses`
- **Overlay**: `clause_library_items` (by clause_number) — overrides risk_category, risk_score, flow_down, mitigation, tags
- **Functions**: `getClauseByNumber`, `getClauseWithOverlay`, `searchClauses`

---

## 9. External Integrations

| Integration | Purpose | Env Vars |
|-------------|---------|----------|
| **PostgreSQL** | Primary data store | DATABASE_URL |
| **OpenAI** | Chat, embeddings, RAG | OPENAI_API_KEY, OPENAI_MODEL |
| **QMS** | Form records (MAC-FRM-013) | QMS_BASE_URL, QMS_INTEGRATION_KEY, QMS_TEMPLATE_CODE_FOR_CLAUSE_ASSESSMENT |
| **Ed25519 keys** | Cryptographic signing | GOV_ED25519_PRIVATE_KEY, GOV_ED25519_PUBLIC_KEY_ID |

---

## 10. Startup & Build

### Production Boot (Railway)

```
npm start
  → node dist/scripts/prodBoot.js
    1. node dist/db/migrate.js     (always)
    2. [if RUN_REG_INGEST=true] node dist/scripts/ingestRegulations.js
    3. node dist/index.js          (Express API)
```

### Build

```
npm run build
  → tsc (backend)
  → node dist/scripts/copyRegulatory.js
  → tsc -b (frontend)
  → vite build (frontend)
  → copy frontend dist to backend/public
```

### Environment Variables (Backend)

| Variable | Effect |
|----------|--------|
| DATABASE_URL | Postgres connection |
| PORT | API port (default 3000) |
| JWT_SECRET, JWT_ISSUER | Auth |
| RUN_REG_INGEST | Run regulatory ingestion on boot when 'true' |
| SAFE_MODE | Skip migrations when 'true' |
| OPENAI_API_KEY | AI / Copilot / RAG |
| GOVERNANCE_STRICT_MODE | Require clause in regulatory_clauses |
| QMS_* | QMS integration |
| GOV_ED25519_* | Ed25519 signing |

---

## 11. Risk Engines (Summary)

| Engine | File | Used By | Factors |
|--------|------|---------|---------|
| **solicitationRiskEngine** | solicitationRiskEngine.ts | Engine /assess | financial, schedule, audit, cyber, flowDown, insurance, ip (7) |
| **governanceScoring** | governanceScoring.ts | Legacy governance | 5 dims |
| **clauseRiskEngine** | clauseRiskEngine.ts | ingestRegulations | Pattern-based risk classification |

Config: `risk_model_config` (score_threshold_l2/l3/l4).

---

## 12. Audit Events

- `created`, `updated` (solicitations)
- `clause_added`, `clause_removed`
- `assessment_submitted`, `assessment_approved`, `assessment_rejected`
- `approve_to_bid_attempted`, `risk_log_generated`
- `form_record_saved`, `form_record_finalized`

Stored in: `governance_audit_events`.

---

## Document History

- Initial: Full system architecture
- Covers migrations 001–013 (incl. QMS, signatures, workflow v1)
