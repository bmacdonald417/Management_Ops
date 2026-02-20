# MacTech Enterprise Federal Governance & Risk Management Platform — Full System Architecture

## 1. Executive Summary

Enterprise-grade, audit-ready Federal Contract Governance & Risk Management Platform for MacTech Solutions LLC. Supports pre-bid solicitation review, clause extraction and risk assessment, approve-to-bid workflow, governance maturity tracking, compliance registry, and AI-assisted Copilot.

**Tech Stack:**
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Deployment:** Railway (single service; Postgres add-on)

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                      │
│  React SPA — Dashboard, Contracts, Compliance, Pre-Bid, Financials, Cyber, Admin  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTPS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS API (Node.js)                                   │
│  /api/auth | contracts | compliance | financials | risk | cyber | governance |   │
│  solicitations | solicitation-clauses | completeness | admin | ai | copilot |    │
│  governance-doctrine | signatures | proposals | qms                              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   PostgreSQL     │          │   OpenAI API     │          │   External QMS    │
│   (primary)      │          │   (Copilot/KB)   │          │   (optional)     │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Directory Structure

```
backend/src/
├── db/
│   ├── connection.ts          # PG pool
│   ├── migrate.ts              # Runs schema + migrations 001–020
│   ├── schema.sql              # Base schema
│   ├── migrations/             # 001–020 (.sql)
│   └── seeds/                  # Dev/seed data
├── lib/
│   └── openaiClient.ts         # OpenAI client for Copilot/KB
├── middleware/
│   ├── auth.ts                 # JWT authenticate, authorize(roles), optionalAuth
│   └── audit.ts                # Audit log middleware
├── routes/
│   ├── auth.ts                 # POST /login, POST /dev-token
│   ├── contracts.ts            # CRUD contracts
│   ├── compliance.ts           # Contract clauses (compliance_clauses)
│   ├── clauseLibrary.ts        # GET/POST/PUT /library (unified_clause_master, overlay)
│   ├── complianceKB.ts         # POST /retrieve (RAG)
│   ├── financials.ts           # Rates, contract costs
│   ├── risk.ts                 # Risk profiles, escalations
│   ├── cyber.ts                # CMMC, incidents
│   ├── users.ts                # User CRUD
│   ├── dashboard.ts            # GET /kpis
│   ├── governance.ts           # Config, dashboard, maturity, auto-builder, reports (legacy solicitations → 410)
│   ├── solicitationEngine.ts   # Solicitations CRUD, extract/manual clauses, approve-to-bid, risk log
│   ├── solicitationClauses.ts  # POST /:id/assess, POST /:id/approve
│   ├── completeness.ts        # GET /org
│   ├── admin.ts               # Compliance registry, regulatory clauses, clause-ssot-validation
│   ├── ai.ts                  # Chat status
│   ├── copilot.ts             # POST /run (modes)
│   ├── signatures.ts          # Signature requests
│   ├── proposals.ts           # Proposals
│   ├── governanceDoctrine.ts  # Doctrine docs, sections, completeness
│   └── qms.ts                 # QMS integration (forms)
├── services/
│   ├── clauseExtractor.ts      # FAR/DFARS regex from text
│   ├── clauseService.ts       # SSOT: unified_clause_master + regulatory_clauses
│   ├── clauseRiskEngine.ts    # (Deprecated for ingest) Pattern-based classification
│   ├── solicitationRiskEngine.ts  # Single risk engine: assess, classifyClauseRiskForIngest
│   ├── governanceScoring.ts   # (Deprecated) 5-dim legacy scoring
│   ├── governanceMaturity.ts  # GCI from solicitation_clauses + clause_risk_assessments
│   ├── workflowEngine.ts      # Approve-to-bid blockers, risk log generation
│   ├── regulatoryParser.ts   # FAR 52 / DFARS 252 HTML parse
│   ├── autoBuilder/           # Context, generate, maturityBridge, sectionRegistry
│   ├── complianceKB/         # Chunk, embeddings, ingest, retrieve, stats
│   ├── complianceRegistry/    # Ingestion, validation, versionControl
│   └── copilot/modes.ts      # RAG-backed Copilot modes
├── scripts/
│   ├── prodBoot.ts            # migrate → [ingest] → API
│   ├── ingestRegulations.ts   # FAR/DFARS HTML → regulatory_clauses, unified_clause_master
│   ├── migrateLegacySolicitationsToEngine.ts
│   ├── migrateClauseData.ts  # Merge clause sources → unified_clause_master
│   └── copyRegulatory.ts     # Post-build copy HTML to dist
└── index.ts                   # Express app, route mounting
```

### 3.2 API Route Inventory

| Module | Base Path | Key Routes |
|--------|-----------|------------|
| Auth | /api/auth | POST /login, POST /dev-token |
| Contracts | /api/contracts | GET/POST/PUT/DELETE, GET/:id |
| Compliance | /api/compliance | GET/POST/PUT /contracts/:id/clauses |
| Clause Library | /api/compliance | GET /library, /library/search, POST /library, PUT /library/:id |
| Compliance KB | /api/compliance | POST /retrieve |
| Financials | /api/financials | GET/POST /rates, contracts/:id/costs |
| Risk | /api/risk | Profiles, escalations |
| Cyber | /api/cyber | CMMC, incidents |
| Users | /api/users | GET /, /:id, PUT |
| Dashboard | /api/dashboard | GET /kpis |
| Governance | /api/governance | /config, /dashboard, /maturity, /auto-builder/*, /reports, /clause-library |
| Solicitation Engine | /api/solicitations | GET/POST /, GET/PATCH /:id, POST /:id/clauses/extract|manual, /:id/approve-to-bid, GET /:id/approve-to-bid/blockers, POST /:id/risk-log/generate |
| Solicitation Clauses | /api/solicitation-clauses | POST /:id/assess, POST /:id/approve |
| Completeness | /api/completeness | GET /org |
| Admin | /api/admin | Compliance registry, regulatory clauses, clause-ssot-validation |
| AI / Copilot | /api/ai, /api/copilot | Chat, run (modes) |
| Governance Doctrine | /api/governance-doctrine | CRUD doctrine docs and sections |
| Signatures | /api/signatures | Signature requests |
| Proposals | /api/proposals | Proposal templates and instances |
| QMS | /api/qms | QMS form integration |

---

## 4. Frontend Architecture

### 4.1 Structure

```
frontend/src/
├── api/
│   └── client.ts               # Axios instance, /api base, JWT interceptors
├── components/
│   ├── Layout.tsx              # Unified nav (Pre-Bid dropdown, Admin dropdown)
│   ├── EmptyState.tsx          # Reusable empty-state CTA
│   ├── governance/             # RiskBadge, EscalationPill, MaturityBanner, SectionCard, Stepper, CopilotDrawer
│   └── copilot/                # CopilotSuggestionsPanel
├── contexts/
│   └── AuthContext.tsx         # useAuth, login, logout
├── config/
│   └── sidebarConfig.tsx       # Pre-Bid nav items
└── pages/
    ├── Login.tsx, Dashboard.tsx, Onboarding.tsx
    ├── Contracts.tsx, ContractDetail.tsx
    ├── Compliance.tsx
    ├── Financials.tsx, Cyber.tsx
    ├── GovernanceEngine.tsx, GovernanceSolicitations.tsx
    ├── GovernanceSolicitationEngineNew.tsx, GovernanceSolicitationEngineDetail.tsx
    ├── GovernanceSolicitationNew.tsx, GovernanceSolicitationReview.tsx
    ├── GovernanceClauseAssess.tsx, GovernanceClauseApprove.tsx
    ├── GovernanceClauseLibrary.tsx
    ├── GovernanceMaturity.tsx, GovernanceReports.tsx
    ├── GovernanceAutoBuilder.tsx, Manual, Evidence, Appendices
    ├── GovernanceCopilot.tsx
    ├── GovernanceDoctrine.tsx
    ├── GovernanceAuditTrail.tsx, GovernancePacketExport.tsx
    ├── GovernanceSignatureRequests.tsx
    ├── Proposals.tsx, ProposalNew.tsx, ProposalDetail.tsx
    └── AdminComplianceRegistry.tsx, AdminRegulatoryLibrary.tsx, AdminAISettings.tsx
```

### 4.2 Routing & RBAC

- **PrivateRoute:** Requires auth; redirects to /login if not authenticated.
- **RequireAdmin:** Guards /admin/*; redirects to / for users without Level 1 or Level 3.
- **Onboarding:** /onboarding; localStorage persistence for completion.

### 4.3 Design System

- **Typography:** `font-display` (Outfit) for headings; `font-sans` (DM Sans) for body.
- **Colors:** gov-navy (#0f172a), gov-blue (#1d4ed8), slate scale.
- **Components:** Shared page headers, primary/secondary buttons, cards. See docs/DESIGN_SYSTEM.md.

---

## 5. Data Model

### 5.1 Core Domain

| Entity | Tables | Purpose |
|--------|--------|---------|
| Users | users | Auth, RBAC (Level 1–5) |
| Contracts | contracts, risk_profiles | Contract lifecycle, risk |
| Contract clauses | compliance_clauses, contract_clauses | Compliance linkage |
| Solicitations | solicitations | Pre-bid opportunities |
| Solicitation clauses | solicitation_clauses, clause_risk_assessments | Engine workflow |

### 5.2 Clause Single Source of Truth

| Table | Role |
|-------|------|
| **regulatory_clauses** | Ingest source (FAR 52, DFARS 252 HTML); risk_category, risk_score from solicititationRiskEngine |
| **unified_clause_master** | SSOT: base from regulatory_clauses + overlay (override_risk_category, override_suggested_mitigation, etc.) |
| **solicitation_clauses** | Links solicitation → clause (clause_id → regulatory_clauses; unified_clause_master_id optional) |
| **contract_clauses** | Links contract → clause; optional unified_clause_master_id (migration 020) |

### 5.3 Governance Engine Flow

```
solicitations
    │
    ├──► solicitation_clauses (FK clause_id → regulatory_clauses; unified_clause_master_id)
    │         │
    │         └──► clause_risk_assessments (risk_level L1–L4, status DRAFT|SUBMITTED|APPROVED)
    │
    ├──► approvals
    ├──► clause_risk_log_snapshots
    └──► governance_completeness_index
```

### 5.4 Supporting Tables

| Area | Tables |
|------|--------|
| Compliance Registry | compliance_data_sources, clause_master, cyber_control_master, cost_accounts, insurance_tiers, indemnification_templates |
| Compliance KB (RAG) | compliance_documents, compliance_chunks (vector embeddings) |
| Copilot | copilot_runs |
| Audit | audit_logs, governance_audit_events |
| CMMC | cmmc_controls, cmmc_assessments |
| Doctrine | governance_doctrine, governance_doctrine_sections, governance_doctrine_section_content |
| Proposals | proposal_templates, proposal_instances, proposal_form_data |

---

## 6. Key Workflows

### 6.1 Solicitation Pre-Bid Workflow

1. **Create:** POST /api/solicitations → status CLAUSE_EXTRACTION_PENDING
2. **Extract clauses:** POST /api/solicitations/:id/clauses/extract (pasted text) or /manual (pick from library)
3. **Assess:** POST /api/solicitation-clauses/:id/assess → clause_risk_assessments
4. **Approve:** POST /api/solicitation-clauses/:id/approve (per clause)
5. **Flow-down review:** Complete on flow-down-required clauses
6. **Approve-to-bid:** POST /api/solicitations/:id/approve-to-bid (blocked until all gates pass)
7. **Risk log:** POST /api/solicitations/:id/risk-log/generate

**Blockers (workflowEngine):** No clauses, unassessed clauses, flow-down incomplete, approvals missing, risk log stale. Blockers can include `actionSolicitationClauseId` for deep-linking to assess page.

### 6.2 Regulatory Ingestion

- **Trigger:** `RUN_REG_INGEST=true` on deploy, or `npm run reg:ingest`
- **Flow:** Parse FAR 52 / DFARS 252 HTML → classifyClauseRiskForIngest → upsert regulatory_clauses, unified_clause_master → sync to compliance_documents/compliance_chunks (RAG) → governance_requirements for high-risk

### 6.3 GCI / Maturity

- **Source:** `solicitation_clauses`, `clause_risk_assessments`, solicitations, approvals
- **Metrics:** Review rate, approval compliance, escalation resolution, clause library usage, etc.
- **Output:** 7 pillars + overall score, gap table, disconnect indicators

### 6.4 Auto-Builder

- **Context:** Maturity, solicitation stats, clause review stats (from engine tables), approval stats, registry stats, KB stats
- **Outputs:** Manual markdown, evidence packet, appendices

---

## 7. Startup & Deployment

### 7.1 Production Boot (Railway)

```
npm start → prodBoot.js
  1. node dist/db/migrate.js     # schema + migrations 001–020
  2. [IF RUN_REG_INGEST=true]   node dist/scripts/ingestRegulations.js
  3. node dist/index.js          # Express API
```

### 7.2 Build

```
npm run build
  - backend: tsc && node dist/scripts/copyRegulatory.js
  - frontend: tsc -b && vite build
  - copy schema, copy frontend to backend/public
```

### 7.3 Environment Variables

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection string |
| PORT | API port (default 3000) |
| JWT_SECRET | Auth token signing |
| OPENAI_API_KEY | Copilot, compliance KB embeddings |
| RUN_REG_INGEST | Run regulatory ingest on boot when 'true' |
| SAFE_MODE | Skip migrations when 'true' |
| QMS_* | QMS integration (optional) |

---

## 8. Security & RBAC

| Role | Access |
|------|--------|
| Level 1 | Full; Admin (Compliance Registry, Regulatory Library, AI Settings) |
| Level 2 | Full; no Admin |
| Level 3 | Full; Admin |
| Level 4 | Program execution; own solicitations |
| Level 5 | Administrative support |

Admin routes and frontend Admin section are restricted to Level 1 and Level 3.

---

## 9. Related Documentation

- [ARCHITECTURE_MAP.md](../ARCHITECTURE_MAP.md) — Detailed schema, redundancy analysis, refactor recommendations
- [docs/LEGACY_DEPENDENCY_MAP.md](LEGACY_DEPENDENCY_MAP.md) — Deprecated legacy endpoints and migration
- [docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — UI design tokens and patterns
- [docs/TESTING.md](TESTING.md) — Regression and validation checklist
