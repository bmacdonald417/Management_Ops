# MacTech Governance Platform — Full System Architecture Map

> Post-consolidation: Legacy solicitation workflow deprecated; single engine, unified risk, clause SSOT. See docs/LEGACY_DEPENDENCY_MAP.md and docs/DESIGN_SYSTEM.md.

---

## 1) DIRECTORY STRUCTURE

### Backend

```
backend/
├── src/
│   ├── db/
│   │   ├── connection.ts
│   │   ├── migrate.ts
│   │   ├── schema.sql
│   │   ├── migrations/          # 001–008
│   │   └── seeds/               # 01–05
│   ├── lib/
│   │   └── openaiClient.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── audit.ts
│   ├── routes/
│   │   ├── admin.ts
│   │   ├── ai.ts
│   │   ├── auth.ts
│   │   ├── clauseLibrary.ts     # /api/compliance (mounted)
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
│   │   └── users.ts
│   ├── scripts/
│   │   ├── copyRegulatory.ts
│   │   ├── ingestRegulations.ts
│   │   ├── prodBoot.ts
│   │   ├── regVerify.ts
│   │   └── seedGovernanceEngineDemo.ts
│   ├── services/
│   │   ├── autoBuilder/
│   │   │   ├── context.ts
│   │   │   ├── generate.ts
│   │   │   ├── maturityBridge.ts
│   │   │   └── sectionRegistry.ts
│   │   ├── clauseExtractor.ts
│   │   ├── clauseRiskEngine.ts
│   │   ├── complianceKB/
│   │   │   ├── chunk.ts
│   │   │   ├── embeddings.ts
│   │   │   ├── ingest.ts
│   │   │   ├── retrieve.ts
│   │   │   ├── stats.ts
│   │   │   └── types.ts
│   │   ├── complianceRegistry/
│   │   │   ├── ingestion.ts
│   │   │   ├── registryStats.ts
│   │   │   ├── types.ts
│   │   │   ├── validation.ts
│   │   │   └── versionControl.ts
│   │   ├── copilot/
│   │   │   └── modes.ts
│   │   ├── governanceMaturity.ts
│   │   ├── governanceScoring.ts
│   │   ├── regulatoryParser.ts
│   │   ├── solicitationRiskEngine.ts
│   │   └── (clauseRiskEngine.ts)
│   └── index.ts
├── regulatory/                   # HTML sources (part_52, part252)
└── dist/                         # Build output
```

### Frontend

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts
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
│       ├── Admin*.tsx            # ComplianceRegistry, RegulatoryLibrary, AISettings
│       ├── Compliance.tsx
│       ├── Contracts.tsx, ContractDetail.tsx
│       ├── Cyber.tsx, Financials.tsx
│       ├── Dashboard.tsx, Login.tsx
│       ├── Governance*.tsx       # Engine, Maturity, Reports, AuditTrail, etc.
│       ├── GovernanceClause*.tsx # Assess, Approve
│       ├── GovernanceSolicitation*.tsx # Engine, EngineDetail, EngineNew, New, Review
│       ├── GovernanceAutoBuilder*.tsx
│       ├── GovernanceCopilot.tsx
│       └── GovernancePacketExport.tsx
└── dist/
```

### Post-consolidation (single workflow, unified risk, clause SSOT)

| Area | Current state |
|------|----------------|
| **Solicitation workflow** | Engine only: `solicitation_clauses` → `clause_risk_assessments`. Legacy routes return 410; use `/api/solicitations`. |
| **Risk scoring** | `solicitationRiskEngine` only (runtime + ingest via `classifyClauseRiskForIngest`). `governanceScoring` / `clauseRiskEngine` deprecated for new code. |
| **Clause SSOT** | `unified_clause_master` (base from `regulatory_clauses` + overlay). `contract_clauses` has optional `unified_clause_master_id`. Validation: GET `/api/admin/clause-ssot-validation`. |
| **GCI / Auto-builder** | Read from `solicitation_clauses` and `clause_risk_assessments` only. |

---

## 2) DATABASE SCHEMA MAP

### Core Tables

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| users | id | auth_id | — | idx_audit_user, etc. |
| audit_logs | id | — | user_id | entity, created, user |
| contracts | id | — | risk_profile_id | status, agency, deleted |
| risk_profiles | id | — | contract_id | contract |
| compliance_clauses | id | (clause_number, regulation) | — | regulation, risk_level, clause_number |
| contract_clauses | id | (contract_id, clause_id) | contract_id, clause_id, reviewed_by | contract, status |
| cmmc_controls | id | control_identifier | — | domain, level, identifier |
| cmmc_assessments | id | (contract_id, control_id) | contract_id, control_id | contract, control |
| documents | id | — | created_by | entity |
| notifications | id | — | user_id | user, read |
| risk_escalations | id | — | risk_profile_id, created_by | profile |
| incident_reports | id | — | contract_id | status, contract |

### Governance Tables

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| risk_model_config | id | config_key | — | — |
| clause_library_items | id | clause_number | updated_by | number, category, type, flow_down, suggested_risk |
| solicitations | id | solicitation_number | owner_id, no_clauses_attested_by | status, owner, agency |
| solicitation_versions | id | (solicitation_id, version) | solicitation_id | sol |
| clause_review_entries | id | — | solicitation_id, version_id, not_applicable_approved_by | sol, version |
| approvals | id | — | solicitation_id | sol |
| governance_audit_events | id | — | actor_id | entity, created |
| governance_metric_snapshots | id | — | — | computed |

### Regulatory / Compliance Registry

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| regulatory_clauses | id | (regulation_type, clause_number) | — | clause_number, regulation_type, risk_score |
| governance_requirements | id | — | reference_id (regulatory_clauses) | reference, domain |
| compliance_data_sources | id | (category, version) | imported_by | category, status, active |
| compliance_registry_errors | id | — | data_source_id | source |
| clause_master | id | (data_source_id, clause_number) | data_source_id | source, number, regulation |
| cyber_control_master | id | (data_source_id, control_identifier) | data_source_id | source, identifier |
| cost_accounts | id | — | data_source_id | source, code |
| insurance_tiers | id | — | data_source_id | source |
| indemnification_templates | id | — | data_source_id | source |

### Governance Engine (Migration 008)

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| solicitation_clauses | id | (solicitation_id, clause_id) | solicitation_id→solicitations, clause_id→regulatory_clauses | sol, clause |
| clause_risk_assessments | id | — | solicitation_clause_id, assessed_by, approved_by | sol_clause, status |
| clause_review_tasks | id | — | solicitation_id, assigned_user_id | sol |
| clause_risk_log_snapshots | id | — | solicitation_id, generated_by | sol, generated |
| governance_completeness_index | id | — | solicitation_id | scope, sol |

### Compliance KB

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| compliance_documents | id | — | data_source_id | doc_type, external_id, canonical_ref, data_source |
| compliance_chunks | id | (document_id, chunk_index) | document_id | document |

### Copilot

| Table | PK | Unique | FKs | Indexes |
|-------|-----|--------|-----|---------|
| copilot_runs | id | — | actor_id | actor, mode, created, related |

### Enums (CHECK / VARCHAR)

- **detected_from**: PASTED_TEXT, UPLOADED_FILE, MANUAL_ADD, API_IMPORT
- **risk_level**: L1, L2, L3, L4 (or 1–4)
- **approval_tier_required**: NONE, MANAGER, QUALITY, EXEC
- **assessment status**: DRAFT, SUBMITTED, APPROVED, REJECTED
- **task_type**: EXTRACTION_REVIEW, RISK_ASSESSMENT, FLOW_DOWN_REVIEW, FINAL_APPROVAL
- **scope**: SOLICITATION, ORG
- **regulation_type**: FAR, DFARS
- **doc_type**: CLAUSE, CONTROL, TEMPLATE, MANUAL_SECTION, POLICY, SOP, FRM
- **validation_status**: PENDING, VALID, INVALID

### Redundancy Analysis (DB)

| Issue | Tables | Impact |
|-------|--------|--------|
| Clause stored 4× | compliance_clauses, clause_library_items, regulatory_clauses, clause_master | Sync risk, inconsistent sources |
| Risk stored 2× | regulatory_clauses.risk_score, clause_risk_assessments | Different semantics; governanceScoring vs solicitationRiskEngine |
| Solicitations dual workflow | clause_review_entries (legacy) vs solicitation_clauses (engine) | Two join models, maturity index only uses legacy |
| Orphaned table | compliance_clauses | Used by contract_clauses; not by governance engine or regulatory ingest |

---

## 3) ENTITY RELATIONSHIP DIAGRAM (Text-Based)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│    users        │────▶│   solicitations      │◀────│  solicitation_      │
└────────┬────────┘     └──────────┬───────────┘     │  versions           │
         │                         │                 └─────────────────────┘
         │                         │
         │                         │  LEGACY PATH
         │                         ├──────────────────▶ clause_review_entries
         │                         │                    (clause_number free text)
         │                         │
         │                         │  ENGINE PATH
         │                         ├──────────────────▶ solicitation_clauses
         │                         │                           │
         │                         │                           ▼
         │                         │                    regulatory_clauses
         │                         │                           │
         │                         │                           ▼
         │                         │                    clause_risk_assessments
         │                         │                    clause_risk_log_snapshots
         │                         │
         │                         ├──────────────────▶ approvals
         │                         │
         │                         └──────────────────▶ governance_completeness_index
         │
         │     ┌─────────────────────────────────────────────────────────────┐
         │     │  CLAUSE LIBRARY SOURCES (overlapping)                        │
         │     ├─────────────────────────────────────────────────────────────┤
         │     │  clause_library_items  (Quality-editable, 5-dim scores)      │
         │     │  regulatory_clauses    (FAR/DFARS ingest, risk_category)     │
         │     │  compliance_clauses    (legacy contract-clause link)         │
         │     │  clause_master         (compliance_registry import)          │
         │     └─────────────────────────────────────────────────────────────┘
         │
         │     ┌─────────────────────────────────────────────────────────────┐
         │     │  COMPLIANCE REGISTRY                                         │
         │     ├─────────────────────────────────────────────────────────────┤
         │     │  compliance_data_sources ──▶ clause_master                   │
         │     │                           ──▶ cyber_control_master           │
         │     │                           ──▶ cost_accounts                  │
         │     │                           ──▶ insurance_tiers                │
         │     │                           ──▶ indemnification_templates      │
         │     │  compliance_registry_errors                                  │
         │     └─────────────────────────────────────────────────────────────┘
         │
         │     ┌─────────────────────────────────────────────────────────────┐
         │     │  KNOWLEDGE BASE (RAG)                                        │
         │     ├─────────────────────────────────────────────────────────────┤
         │     │  compliance_documents ──▶ compliance_chunks (embeddings)     │
         │     │  (linked to data_source_id)                                  │
         │     └─────────────────────────────────────────────────────────────┘
         │
         │     ┌─────────────────────────────────────────────────────────────┐
         │     │  GOVERNANCE METRICS                                          │
         │     ├─────────────────────────────────────────────────────────────┤
         │     │  governance_metric_snapshots (GCI pillars)                   │
         │     │  governance_requirements (high-risk → domain weights)        │
         │     │  governance_audit_events                                     │
         │     └─────────────────────────────────────────────────────────────┘
         │
         └────▶ copilot_runs (actor_id, related_entity_id)
```

---

## 4) API ROUTE INVENTORY

### By Module

| Module | Base Path | Routes |
|--------|-----------|--------|
| **Auth** | /api/auth | POST /login, POST /dev-token |
| **Contracts** | /api/contracts | GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /:id/clauses |
| **Compliance** | /api/compliance | GET /contracts/:id/clauses, POST, PUT |
| **Clause Library** | /api/compliance | GET /library, GET /library/search, GET /library/by-number/:n, POST /library, POST /library/seed, PUT /library/:id, GET /library/:id, GET /library/constants |
| **Compliance KB** | /api/compliance | POST /retrieve |
| **Financials** | /api/financials | GET /rates, POST, GET /contracts/:id/costs, POST |
| **Risk** | /api/risk | GET /profiles/:id, POST, PUT, POST (escalations) |
| **Cyber** | /api/cyber | GET /cmmc/controls, GET /contracts/:id/cmmc, PUT, GET /incidents, POST, PUT |
| **Users** | /api/users | GET /, GET /:id, PUT |
| **Dashboard** | /api/dashboard | GET /kpis |
| **Governance** | /api/governance | GET /config, GET /dashboard, GET /solicitations, POST /solicitations, GET /solicitations/:id, PUT /solicitations/:id, POST /solicitations/:id/clauses, POST /solicitations/:id/clauses/bulk, PUT /solicitations/:id/clauses/:cid, POST /solicitations/:id/submit, POST /solicitations/:id/approve, POST /solicitations/:id/finalize, GET /solicitations/:id/audit, GET /clause-library, POST /clause-library, GET /reports, GET /constants, GET /maturity, GET /auto-builder/context, GET /auto-builder/manual, GET /auto-builder/evidence, GET /auto-builder/appendices |
| **Solicitation Engine** | /api/solicitations | GET /clause-library, GET /, POST /, GET /:id, PATCH /:id, POST /:id/clauses/extract, POST /:id/clauses/manual, POST /:id/approve-to-bid, GET /:id/approve-to-bid/blockers, POST /:id/risk-log/generate, GET /:id/risk-log/latest, GET /:id/completeness |
| **Solicitation Clauses** | /api/solicitation-clauses | POST /:id/assess, POST /:id/approve |
| **Completeness** | /api/completeness | GET /org |
| **Admin** | /api/admin | GET /compliance-registry/sources, GET /stats, GET /sources/:id/errors, POST /upload, GET /kb-stats, POST /sync-documents, POST /run-chunking, POST /run-embeddings, GET /regulatory-clauses, POST /sources/:id/activate |
| **AI** | /api/ai | GET /status, POST /chat |
| **Copilot** | /api/copilot | POST /run, POST (various modes) |

### Overlapping Functionality

| Overlap | Path A | Path B | Notes |
|---------|--------|--------|-------|
| **Clause library** | GET /api/compliance/library | GET /api/solicitations/clause-library | Different sources: clause_library_items vs regulatory_clauses |
| **Solicitations list** | GET /api/governance/solicitations | GET /api/solicitations | Legacy vs Engine; different response shape |
| **Solicitation detail** | GET /api/governance/solicitations/:id | GET /api/solicitations/:id | clause_entries vs solicitation_clauses |
| **Clause add** | POST /api/governance/solicitations/:id/clauses | POST /api/solicitations/:id/clauses/extract, /manual | Legacy: free-text clause_number; Engine: extract or link to regulatory_clauses |

---

## 5) BUSINESS LOGIC MAP

| Logic | Location | Triggers |
|-------|----------|----------|
| **Migrations** | `db/migrate.ts` | prodBoot (always) or `npm run db:migrate` |
| **Regulatory ingestion** | `scripts/ingestRegulations.ts` | prodBoot when RUN_REG_INGEST=true; `npm run reg:ingest` |
| **Regulatory copy** | `scripts/copyRegulatory.ts` | `npm run build` (post-tsc) |
| **Reg verification** | `scripts/regVerify.ts` | `npm run reg:verify` (no DB write) |
| **Risk scoring (Legacy)** | `services/governanceScoring.ts` | governance routes (add/update clause, submit) |
| **Risk scoring (Ingest)** | `services/clauseRiskEngine.ts` | ingestRegulations (classifyClauseRisk) |
| **Risk scoring (Engine)** | `services/solicitationRiskEngine.ts` | solicitationClauses /assess route |
| **Completeness index** | `routes/completeness.ts` (GET :id/completeness) | On-demand per solicitation |
| **Completeness org** | `routes/completeness.ts` (GET /org) | On-demand |
| **Governance maturity (GCI)** | `services/governanceMaturity.ts` | GET /governance/maturity, autoBuilder context |
| **RBAC** | `middleware/auth.ts` (authorize) | All protected routes |
| **Approve-to-bid blockers** | `routes/solicitationEngine.ts` | Inline in getApproveToBidBlockers |
| **Risk log generation** | `routes/solicitationEngine.ts` | POST :id/risk-log/generate (inline) |

---

## 6) STARTUP FLOW MAP

### Production Boot (Railway)

```
1. npm start
   └─▶ backend: node dist/scripts/prodBoot.js

2. prodBoot.js
   ├─▶ 2a. node dist/db/migrate.js
   │        ├─ schema.sql
   │        └─ migrations/*.sql (001..008)
   │
   ├─▶ 2b. IF RUN_REG_INGEST=true
   │        └─ node dist/scripts/ingestRegulations.js
   │
   └─▶ 2c. node dist/index.js  (Express API)
            └─ Listens on PORT
```

### Env Variables Affecting Behavior

| Variable | Effect |
|----------|--------|
| DATABASE_URL | Postgres connection |
| PORT | API port (default 3000) |
| RUN_REG_INGEST | Run regulatory ingestion on boot when 'true' |
| SAFE_MODE | Skip migrations when 'true' |
| JWT_SECRET | Auth token signing |
| OPENAI_API_KEY | Copilot / AI features |
| GOVERNANCE_STRICT_MODE | Require clause in regulatory_clauses for governance add |
| SKIP_DFARS_MIN_COUNT | Skip DFARS min-count check during ingest |

### Build Sequence

```
npm run build
├─ build:backend: tsc && node dist/scripts/copyRegulatory.js
├─ copy-schema.js
├─ build:frontend: tsc -b && vite build
└─ copy-frontend.js
```

---

## 7) REDUNDANCY ANALYSIS

### Duplicate Risk Scoring Engines

| Engine | File | Used By | Factors |
|--------|------|---------|---------|
| **governanceScoring** | governanceScoring.ts | governance routes (legacy) | financial, cyber, liability, regulatory, performance (5 dims) |
| **solicitationRiskEngine** | solicitationRiskEngine.ts | solicitationClauses /assess | financial, schedule, audit, cyber, flowDown, insurance, ip (7 factors) |
| **clauseRiskEngine** | clauseRiskEngine.ts | ingestRegulations | Pattern-based; riskCategory, riskScore, flowDown |

→ Three different models; no shared config for weights/thresholds across engines.

### Duplicate Clause Sources

| Source | Table | Populated By | Used By |
|--------|-------|--------------|---------|
| Regulatory | regulatory_clauses | ingestRegulations | Engine (solicitation_clauses), Admin Regulatory Library |
| Library | clause_library_items | Seeds, POST /compliance/library | Legacy governance, Clause Library UI, autoBuilder context |
| Legacy | compliance_clauses | (legacy) | contract_clauses |
| Registry | clause_master | Compliance registry CSV import | Compliance registry |

→ regulatory_clauses and clause_library_items both represent FAR/DFARS; no sync.

### Duplicate Regulatory Storage

- **regulatory_clauses**: Full text, risk from clauseRiskEngine, from HTML parse.
- **clause_library_items**: Manual/seed, 5-dim defaults, Quality-editable.
- **clause_master**: From compliance_data_sources imports.

### Dead Code / Low-Use Paths

- **compliance_clauses**: Only used by contract_clauses; contracts flow is separate from solicitations.
- **clause_review_entries**: Legacy; maturity only reads this, not solicitation_clauses.
- **clause_review_tasks**: Created in migration, no route creates/completes tasks.

### Overlapping Workflow Models

- **Legacy**: solicitations → solicitation_versions → clause_review_entries (free-text clause_number) → approvals → finalize.
- **Engine**: solicitations → solicitation_clauses (FK to regulatory_clauses) → clause_risk_assessments → approvals → approve-to-bid.
- Governance maturity and autoBuilder context only consider the legacy path.

### Orphaned / Underused Tables

- **clause_review_tasks**: No API to create or update.
- **governance_completeness_index**: Inserted on GET completeness; no unique constraint, can accumulate duplicates.
- **compliance_clauses**: Orphaned relative to governance engine.

---

## 8) MISALIGNMENT ANALYSIS

### Logic Outside Correct Module

| Issue | Location | Preferred |
|-------|----------|-----------|
| Path resolution for regulatory HTML | ingestRegulations.ts | Shared util (e.g. lib/regulatoryPaths) |
| Approve-to-bid blocker logic | solicitationEngine.ts (inline) | Service (e.g. workflowEngine) |
| Risk log generation formula | solicitationEngine.ts (inline) | solicitationRiskEngine or workflow service |
| Completeness calculation | completeness.ts route | governanceMaturity or dedicated service |

### Governance Logic in Ingestion Layer

- `ingestRegulations` calls `classifyClauseRisk` and writes risk_category, risk_score to regulatory_clauses.
- Ingestion mixes parsing, risk classification, and persistence; risk rules live in clauseRiskEngine, not a central risk config.

### Risk Scoring in Controller Instead of Service

- governance routes: `computeClauseScore`, `scoreToRiskLevel` called directly in handlers.
- Engine: `assessClauseRisk` correctly in service; route only passes params.

### UI Doing Validation Backend Should Enforce

- Approve-to-bid disabled state derived from blockers; backend correctly blocks, but UI re-fetches blockers.
- Some forms may allow invalid enum values if backend validation is incomplete.
- No systematic schema/validation docs shared between frontend and backend.

---

## 9) CLEAN ARCHITECTURE RECOMMENDATION

### Proposed Modular Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GOVERNANCE ENGINE                                                           │
│  - Solicitations (single workflow model)                                     │
│  - Clause extraction, assessment, approvals, risk log, approve-to-bid        │
│  - governance_audit_events                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPLIANCE LIBRARY (single source of truth)                                 │
│  - regulatory_clauses as canonical FAR/DFARS                                 │
│  - Deprecate: clause_library_items (merge or migrate), compliance_clauses    │
│  - clause_master: registry import staging only                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  RISK ENGINE (unified)                                                       │
│  - Single service: weights, thresholds, hard stops from risk_model_config    │
│  - Deprecate: governanceScoring, clauseRiskEngine (fold into one engine)     │
│  - solicitationRiskEngine as primary; extend for legacy if needed            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW ENGINE                                                             │
│  - clause_review_tasks CRUD                                                  │
│  - Approve-to-bid gate logic                                                 │
│  - Task assignment, due dates                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  COPILOT / RAG ENGINE                                                        │
│  - complianceKB, copilot routes, copilot_runs                                │
│  - Modes, retrieve, embeddings                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  REPORTING ENGINE                                                            │
│  - GCI / maturity (governanceMaturity)                                       │
│  - Completeness index                                                        │
│  - Auto-builder, packet export                                               │
│  - Dashboard KPIs                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Refactor Plan (Phased, by Risk)

#### Phase 1 — Low risk (config / structure)

1. Extract regulatory path resolution to `lib/regulatoryPaths.ts`.
2. Move approve-to-bid blocker logic to `services/workflowEngine.ts` or similar.
3. Move risk-log generation logic from route to service.
4. Add unique constraint or upsert for governance_completeness_index.

#### Phase 2 — Medium risk (consolidation)

5. Unify risk scoring: make solicitationRiskEngine the single engine; migrate legacy to same config/API or adaptor.
6. Add clause_review_tasks API (create, complete) and wire to Engine flow.
7. Update governanceMaturity and autoBuilder to include solicitation_clauses in addition to clause_review_entries.

#### Phase 3 — Higher risk (data model)

8. Choose canonical clause table: regulatory_clauses or merged model; plan migration from clause_library_items.
9. Deprecate legacy solicitation flow (clause_review_entries) and migrate existing data to engine model.
10. Deprecate compliance_clauses or formalize as contract-only (non-governance) model.

#### Phase 4 — API / route cleanup

11. Consolidate clause library endpoints (one source, one API surface).
12. Consolidate solicitation endpoints; single list/detail with unified response.
13. Remove duplicate routes and document public API.

---

## Summary

- **Clause SSOT:** `unified_clause_master`; regulatory ingest and migrateClauseData populate it. Contract clause link via `contract_clauses.unified_clause_master_id` (migration 020).
- **Single risk engine:** `solicitationRiskEngine` (runtime + ingest classification). GCI and Auto-builder use engine tables only.
- **Single solicitation workflow:** Engine only; legacy routes return 410. Migration script: `npm run migrate:legacy-solicitations`.
- **Startup:** migrate → optional ingest → API. Frontend: unified Pre-Bid nav, Admin RBAC, onboarding, empty states, approve-to-bid blocker deep-links.
