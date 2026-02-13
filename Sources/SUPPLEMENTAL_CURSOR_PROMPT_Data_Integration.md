# Supplemental Cursor Prompt: Reference Data Integration

## Context

You are continuing development of the **MacTech Federal Contract Governance & Risk Management Platform**. The `Sources` folder in the project contains critical reference documents and structured data files that **must be integrated** into the system. These files form the compliance backbone of the platform.

**Use this supplemental prompt together with:**
- Main prompt: `Cursor Prompt_ Build the MacTech Enterprise Federal Governance & Risk Management Platform.md`
- Implementation roadmap: `../Implementation_Roadmap_MacTech_Governance_Platform.md`
- Architecture spec: `system_architecture_and_api.md`

---

## 1. Source Files Inventory

The `Sources` folder (`c:\Users\bmacd\.cursor\Managment Ops\Sources\`) contains:

| File | Description | Records |
|------|-------------|---------|
| `far_clauses_sample.csv` | FAR Part 52 clauses | 50 |
| `dfars_clauses_sample.csv` | DFARS Part 252 clauses | 50 |
| `nist_800_171_controls.csv` | NIST SP 800-171 / CMMC Level 2 controls | 110 |
| `NIST_SP_800-171_Rev2.pdf` | Official NIST CUI protection publication | Reference |
| `NIST_SP_800-53_Rev5.pdf` | Security control catalog | Reference |
| `Data Collection Summary - Federal Governance Reference Documents.md` | Data inventory | — |
| `REQUIRED_REFERENCE_DOCUMENTS.md` | Data format specifications | — |
| `GovernancePhilosophy&EnterpriseRiskDoctrine.txt` | Governance manual | — |
| `system_architecture_and_api.md` | API specification | — |

**Note:** Add NIST PDFs to Sources when available. CSV files are present and ready for import.

---

## 2. CSV Schema Mapping

### FAR/DFARS Clauses (`far_clauses_sample.csv`, `dfars_clauses_sample.csv`)

| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| clause_number | clause_number | VARCHAR(50) | e.g., "52.201-1" or "252.204-7012" |
| title | title | TEXT | — |
| regulation | regulation | VARCHAR(20) | 'FAR' or 'DFARS' |
| full_text_url | full_text_url | TEXT | — |
| risk_category | risk_category | VARCHAR(100) | May be "TBD"; refine from governance manual Appendix A |
| risk_level | risk_level | INTEGER | 1–4 |
| description | description | TEXT | — |
| flow_down_required | flow_down_required | BOOLEAN | "Yes" → true |
| applicability_notes | applicability_notes | TEXT | — |

### NIST 800-171 / CMMC Controls (`nist_800_171_controls.csv`)

| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| control_identifier | control_identifier | VARCHAR(50) | e.g., "AC.L2-3.1.1" |
| domain | domain | VARCHAR(100) | e.g., "Access Control" |
| level | level | VARCHAR(20) | "Level 2" |
| practice_statement | practice_statement | TEXT | — |
| objective | objective | TEXT | — |
| discussion | discussion | TEXT | — |
| evidence_examples | evidence_examples | TEXT | — |

---

## 3. Database Schema (PostgreSQL)

Create these tables. Align with the Compliance and Cyber services in the main architecture. Use `compliance_clauses` if the main spec uses `clauses`—these are equivalent; the extended schema below supports the imported data.

```sql
-- Compliance Clauses (FAR/DFARS)
CREATE TABLE IF NOT EXISTS compliance_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_number VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  regulation VARCHAR(20) NOT NULL,
  full_text TEXT,
  full_text_url TEXT,
  risk_category VARCHAR(100),
  risk_level INTEGER CHECK (risk_level BETWEEN 1 AND 4),
  description TEXT,
  flow_down_required BOOLEAN DEFAULT true,
  applicability_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clause_number, regulation)
);

CREATE INDEX idx_clauses_regulation ON compliance_clauses(regulation);
CREATE INDEX idx_clauses_risk_level ON compliance_clauses(risk_level);
CREATE INDEX idx_clauses_number ON compliance_clauses(clause_number);

-- CMMC Controls (NIST 800-171)
CREATE TABLE IF NOT EXISTS cmmc_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_identifier VARCHAR(50) NOT NULL UNIQUE,
  domain VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  practice_statement TEXT NOT NULL,
  objective TEXT NOT NULL,
  discussion TEXT,
  evidence_examples TEXT,
  nist_800_171_mapping VARCHAR(50),
  nist_800_53_mapping VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cmmc_domain ON cmmc_controls(domain);
CREATE INDEX idx_cmmc_level ON cmmc_controls(level);
CREATE INDEX idx_cmmc_identifier ON cmmc_controls(control_identifier);

-- Contract–Clause Link (maps to main architecture contract_clauses)
CREATE TABLE IF NOT EXISTS contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id UUID NOT NULL REFERENCES compliance_clauses(id) ON DELETE CASCADE,
  compliance_status VARCHAR(50) DEFAULT 'Not Started',
  notes TEXT,
  evidence_document_ids UUID[],
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, clause_id)
);

CREATE INDEX idx_contract_clauses_contract ON contract_clauses(contract_id);
CREATE INDEX idx_contract_clauses_status ON contract_clauses(compliance_status);

-- CMMC Assessments (per contract)
CREATE TABLE IF NOT EXISTS cmmc_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  control_id UUID NOT NULL REFERENCES cmmc_controls(id) ON DELETE CASCADE,
  implementation_status VARCHAR(50) DEFAULT 'Not Implemented',
  assessment_score INTEGER CHECK (assessment_score BETWEEN 0 AND 5),
  evidence_description TEXT,
  evidence_document_ids UUID[],
  assessor_notes TEXT,
  last_assessed_at TIMESTAMPTZ,
  assessed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, control_id)
);

CREATE INDEX idx_cmmc_assessments_contract ON cmmc_assessments(contract_id);
CREATE INDEX idx_cmmc_assessments_control ON cmmc_assessments(control_id);
CREATE INDEX idx_cmmc_assessments_status ON cmmc_assessments(implementation_status);
```

---

## 4. Seed Script Requirements

Create seed scripts in `backend/src/db/seeds/` (or equivalent). Path to Sources from backend: `../../Sources/` or `../../../Sources/` depending on backend structure.

### Seed Execution Order

1. **01_import_far_dfars_clauses** — Import `far_clauses_sample.csv` and `dfars_clauses_sample.csv`
2. **02_import_nist_controls** — Import `nist_800_171_controls.csv`

### Parsing Rules

- **clause_number:** Use as-is. FAR CSV uses "52.201-1"; DFARS uses "252.204-7012".
- **risk_level:** Parse with `parseInt()`; default to 2 if invalid.
- **flow_down_required:** `row.flow_down_required === 'Yes'` → true.
- ** regulation:** Must be "FAR" or "DFARS" from CSV.
- **CMMC:** All fields map directly. Use `ON CONFLICT (control_identifier) DO UPDATE` for idempotency.

### Expected Outcome

- ~100 compliance clauses (50 FAR + 50 DFARS)
- 110 CMMC controls
- Idempotent seeds (safe to re-run)

---

## 5. API Alignment

The main architecture defines:

- `GET /api/compliance/library` → Return `compliance_clauses` with filters: `regulation`, `risk_level`, `search`
- `POST /api/compliance/library` → Add clause to `compliance_clauses`
- `GET /api/compliance/contracts/{contractId}/clauses` → Join `contract_clauses` with `compliance_clauses`
- `POST /api/compliance/contracts/{contractId}/clauses` → Insert into `contract_clauses`
- `PUT /api/compliance/contracts/{contractId}/clauses/{linkId}` → Update `contract_clauses`

**Cyber service (CMMC):**

- `GET /api/cyber/cmmc/controls` → Return `cmmc_controls` with filters: `domain`, `level`
- `POST /api/cyber/cmmc/controls` → Add to `cmmc_controls`
- Add: `GET /api/cyber/contracts/{contractId}/cmmc` → CMMC assessment per contract
- Add: `PUT /api/cyber/contracts/{contractId}/cmmc/{controlId}` → Update assessment

---

## 6. Frontend Integration

### Contract Clause Manager

- **Location:** `frontend/src/components/Compliance/ContractClauseManager.tsx`
- **Purpose:** Show clauses for a contract with risk level, compliance status, filtering
- **Data:** `GET /api/compliance/contracts/{contractId}/clauses`
- **Actions:** Update compliance status via `PUT`; link new clauses from library

### CMMC Dashboard

- **Location:** `frontend/src/components/Cyber/CMMCDashboard.tsx`
- **Purpose:** CMMC Level 2 assessment by domain; progress tracking
- **Data:** `GET /api/cyber/contracts/{contractId}/cmmc`
- **Actions:** Update implementation status, assessment score, evidence

---

## 7. Execution Checklist

When implementing data integration:

| # | Task | Phase |
|---|------|-------|
| 1 | Create `compliance_clauses`, `cmmc_controls`, `contract_clauses`, `cmmc_assessments` | Phase I |
| 2 | Install `csv-parser` (or `papaparse`) in backend | Sprint 0 |
| 3 | Implement seed scripts with correct Source paths | Phase I |
| 4 | Run seeds; verify 100 clauses + 110 controls | Phase I |
| 5 | Wire Compliance API to new tables | Phase I |
| 6 | Wire Cyber API for CMMC controls and assessments | Phase II |
| 7 | Build ContractClauseManager and CMMCDashboard | Phase I / II |
| 8 | Integrate into Contract Detail hub | Phase I |

---

## 8. Risk Classification Enhancement

Clause risk levels in the CSVs may be "TBD" or generic. Refine using the governance manual Appendix A:

- **Level 4 (Critical):** DFARS 252.204-7012, 252.204-7021; FAR 52.249-2, 52.249-6; termination, cyber, cost-reimbursable
- **Level 3 (High):** FAR 52.215-2, 52.232-20, 52.232-22; audit, limitation of cost/funds
- **Level 2 (Medium):** Standard administrative clauses
- **Level 1 (Low):** Routine reporting, definitions

Apply these refinements in seed logic or a post-import update script.

---

## 9. Path Reference (Windows Workspace)

```
c:\Users\bmacd\.cursor\Managment Ops\
├── Sources\
│   ├── far_clauses_sample.csv
│   ├── dfars_clauses_sample.csv
│   ├── nist_800_171_controls.csv
│   ├── NIST_SP_800-171_Rev2.pdf
│   ├── NIST_SP_800-53_Rev5.pdf
│   └── ... (other docs)
├── Implementation_Roadmap_MacTech_Governance_Platform.md
└── (backend/, frontend/ when created)
```

Use `path.join(__dirname, '../../Sources/far_clauses_sample.csv')` or equivalent from backend seed scripts. Prefer relative paths for portability.

---

*This supplemental prompt ensures the platform integrates the compliance reference data from Sources and aligns with the main Cursor prompt and Implementation Roadmap.*
