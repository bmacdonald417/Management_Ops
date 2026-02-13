# MacTech Enterprise Federal Governance & Risk Management Platform
## Implementation Roadmap & Prioritized Task Breakdown

**Document Version:** 1.0  
**Last Updated:** February 13, 2025  
**Timeline:** 12 months (4 phases)

---

## Table of Contents
1. [Overview](#1-overview)
2. [Prerequisites & Sprint 0](#2-prerequisites--sprint-0)
3. [Phase I — Governance Foundation (Days 0–90)](#3-phase-i--governance-foundation-days-090)
4. [Phase II — Structural Enforcement (Days 90–180)](#4-phase-ii--structural-enforcement-days-90-180)
5. [Phase III — Operational Integration (Days 180–270)](#5-phase-iii--operational-integration-days-180-270)
6. [Phase IV — Enterprise Optimization (Days 270–365)](#6-phase-iv--enterprise-optimization-days-270-365)
7. [Cross-Cutting Tasks](#7-cross-cutting-tasks)
8. [Risk & Dependency Matrix](#8-risk--dependency-matrix)

---

## 1. Overview

This roadmap decomposes the MacTech platform build into **prioritized, dependency-aware tasks** aligned with the 4-phase execution plan. Tasks are sequenced to support incremental delivery and minimize rework.

### Guiding Principles
- **Build backend-first** — APIs and data models before UI
- **Security from day one** — Auth, RBAC, and audit logging in foundational sprint
- **Phase-gated delivery** — Each phase has clear exit criteria
- **Traceability** — All features map to source document requirements

---

## 2. Prerequisites & Sprint 0

**Duration:** 2–3 weeks  
**Goal:** Establish project structure, tooling, and shared infrastructure.

| # | Task | Priority | Effort | Dependencies | Phase |
|---|------|----------|--------|--------------|-------|
| 0.1 | Initialize monorepo or multi-repo structure | P0 | 2d | — | Sprint 0 |
| 0.2 | Set up PostgreSQL (local/dev) and define base schema conventions | P0 | 2d | 0.1 | Sprint 0 |
| 0.3 | Configure AWS accounts (dev/staging/prod), VPC, and base Terraform | P0 | 3d | — | Sprint 0 |
| 0.4 | Configure Auth0 or AWS Cognito tenant; define RBAC roles (Levels 1–5) | P0 | 2d | — | Sprint 0 |
| 0.5 | Create shared TypeScript types, API client SDK, and validation schemas (Zod) | P0 | 2d | 0.1 | Sprint 0 |
| 0.6 | Implement JWT validation middleware and RBAC enforcement library | P0 | 2d | 0.4 | Sprint 0 |
| 0.7 | Create `audit_logs` table and immutable audit middleware | P0 | 2d | 0.2 | Sprint 0 |
| 0.8 | Configure S3 bucket with versioning, encryption (KMS), and IAM policies | P0 | 1d | 0.3 | Sprint 0 |
| 0.9 | Set up CI/CD pipeline (GitHub Actions) for build, test, and deploy | P1 | 2d | 0.1 | Sprint 0 |
| 0.10 | Create React + Vite + TypeScript + Tailwind frontend scaffold | P1 | 1d | 0.1 | Sprint 0 |

**Sprint 0 Exit Criteria:**
- [ ] Dev environment runs locally (DB, Auth, S3)
- [ ] One hello-world API endpoint secured with JWT + RBAC
- [ ] One audit log entry written on API call
- [ ] Frontend login flow works with Auth0/Cognito

---

## 3. Phase I — Governance Foundation (Days 0–90)

**Focus:** Core Contracts, Compliance (Clause Log), and Financials (Chart of Accounts).

### 3.1 Contracts Service

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 1.1 | Implement Contract data model and PostgreSQL schema | P0 | 1d | 0.2 | `contracts` table |
| 1.2 | Implement `POST /api/contracts`, `GET /api/contracts`, `GET /api/contracts/{id}` | P0 | 2d | 0.6, 0.7, 1.1 | CRUD (create, list, get) |
| 1.3 | Implement `PUT /api/contracts/{id}`, `DELETE /api/contracts/{id}` (soft delete) | P0 | 1d | 1.2 | Full CRUD |
| 1.4 | Implement `POST /api/contracts/{id}/phases` — lifecycle phase advancement | P0 | 1d | 1.2 | Phase workflow |
| 1.5 | Add query filters: `status`, `agency`, `contract_type` | P1 | 0.5d | 1.2 | Filterable list |
| 1.6 | Pre-bid review workflow (gate before Awarded phase) | P0 | 2d | 1.4 | Pre-bid gate |

### 3.2 Compliance Service (Clause Log)

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 2.1 | Implement Clause and ContractClauseLink data models | P0 | 1d | 0.2 | `clauses`, `contract_clauses` |
| 2.2 | Implement `GET /api/compliance/library`, `POST /api/compliance/library` | P0 | 1d | 0.6, 0.7, 2.1 | Clause library |
| 2.3 | Implement contract-clause linking endpoints | P0 | 1d | 1.2, 2.2 | Clause Risk Log |
| 2.4 | Seed FAR/DFARS baseline clause library (critical clauses) | P1 | 2d | 2.2 | Clause library populated |
| 2.5 | Clause risk scoring and risk-level classification | P1 | 1d | 2.2 | Risk categories |

### 3.3 Financials Service (Chart of Accounts)

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 3.1 | Implement JobCostLog and IndirectRate data models | P0 | 1d | 0.2 | DCAA-aligned schema |
| 3.2 | Implement `GET/POST /api/financials/rates` | P0 | 1d | 0.6, 0.7, 3.1 | Indirect rates API |
| 3.3 | Implement `GET/POST /api/financials/contracts/{id}/costs` | P0 | 1d | 1.2, 3.1 | Job cost logs API |
| 3.4 | Define and seed DCAA-aligned Chart of Accounts | P0 | 2d | 3.1 | CoA structure |

### 3.4 Supporting Services (Phase I)

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 4.1 | Users Service: `GET/PUT /api/users`, role sync from Auth0/Cognito | P0 | 2d | 0.4 | User management |
| 4.2 | Documents Service: pre-signed upload/download URLs | P0 | 2d | 0.8 | Secure file handling |
| 4.3 | Notifications Service: create and list notifications | P1 | 1d | 4.1 | In-app notifications |

### 3.5 Frontend — Phase I

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 5.1 | Layout shell: sidebar nav, header, auth context | P0 | 1d | 0.10 | App shell |
| 5.2 | Contracts list view (searchable, filterable) | P0 | 2d | 1.2, 5.1 | Contracts module |
| 5.3 | Contract detail view (hub: risk, clauses, costs, docs) | P0 | 3d | 1.2, 2.3, 3.3, 4.2, 5.2 | Contract hub |
| 5.4 | Compliance module: Clause Library browser + contract linking | P0 | 2d | 2.3, 5.1 | Compliance module |
| 5.5 | Financials module: indirect rates, job cost entry | P0 | 2d | 3.2, 3.3, 5.1 | Financials module |
| 5.6 | Basic Executive Dashboard (contract counts, simple KPIs) | P1 | 1d | 5.2, 5.4 | Dashboard v1 |

**Phase I Exit Criteria:**
- [ ] Full contract lifecycle: Opportunity → Pre-Bid → Awarded → Active → Closed
- [ ] Clause Risk Log operational; clauses linked to contracts
- [ ] DCAA-aligned Chart of Accounts and job cost logging
- [ ] Pre-bid review workflow enforced
- [ ] Secure document upload/download

---

## 4. Phase II — Structural Enforcement (Days 90–180)

**Focus:** Automated financial/cyber controls, indemnification workflow, 72-hour incident reporting.

### 4.1 Risk Service

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 6.1 | Implement RiskProfile data model and APIs | P0 | 1d | 0.2, 1.2 | Risk profiles |
| 6.2 | Implement `POST /api/risk/escalations` | P0 | 1d | 6.1 | Escalation logging |
| 6.3 | Indemnification classification and escalation workflow | P0 | 2d | 6.1, 2.2 | Indemnification engine |

### 4.2 Financials — Automation

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 7.1 | Automated indirect rate calculator (Fringe, Overhead, G&A) | P0 | 2d | 3.2 | Rate calculator |
| 7.2 | Quarterly allowability review protocol (workflow + alerts) | P1 | 2d | 3.3 | Allowability reviews |
| 7.3 | FAR Part 31 unallowable cost flagging | P1 | 1d | 3.3 | Unallowable flags |

### 4.3 Cyber Service

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 8.1 | Implement CMMCControl and IncidentReport data models | P0 | 1d | 0.2 | Cyber schema |
| 8.2 | Implement CMMC controls API (`GET/POST`) | P0 | 1d | 0.6, 0.7, 8.1 | CMMC library |
| 8.3 | Implement incident report API (`GET/POST/PUT`) | P0 | 1d | 8.1 | Incident API |
| 8.4 | 72-hour incident reporting workflow (deadline tracking, alerts) | P0 | 2d | 8.3, 4.3 | 72-hour tracker |
| 8.5 | CUI system boundary documentation structure | P1 | 1d | 8.1 | CUI boundary docs |

### 4.4 Frontend — Phase II

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 9.1 | Risk module: Risk Classification Matrix, escalation list | P0 | 2d | 6.1, 6.2, 5.1 | Risk module |
| 9.2 | Cyber module: CMMC controls, incident reporting, 72-hour tracker | P0 | 3d | 8.2, 8.3, 8.4 | Cyber module |
| 9.3 | Financials: indirect rate calculator UI, allowability alerts | P1 | 1d | 7.1, 7.2 | Financials automation UI |
| 9.4 | Integrate RiskProfile into contract detail view | P0 | 0.5d | 6.1, 5.3 | Contract–risk link |

**Phase II Exit Criteria:**
- [ ] Automated indirect rate calculator deployed
- [ ] Indemnification classification and escalation workflow live
- [ ] 72-hour cyber incident reporting framework operational
- [ ] CUI boundary documentation structure in place

---

## 5. Phase III — Operational Integration (Days 180–270)

**Focus:** Measurable governance — KPI dashboard, subcontractor cyber affirmation, CMMC readiness.

### 5.1 Governance KPIs

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 10.1 | KPI aggregation API: Active vs Opportunities, risk distribution, open tasks | P0 | 2d | 1.2, 6.1, 2.3 | KPI API |
| 10.2 | Funding threshold monitoring and alerts | P1 | 1d | 3.3, 1.2 | Funding alerts |
| 10.3 | Pending approvals queue and notifications | P1 | 1d | 4.3, 1.4 | Approvals queue |

### 5.2 Cyber — CMMC & Subcontractors

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 11.1 | POA&M tracking structure (Plans of Action & Milestones) | P0 | 2d | 8.2 | POA&M module |
| 11.2 | Subcontractor cyber affirmation workflow/portal | P0 | 2d | 4.1, 8.1 | Cyber affirmation |
| 11.3 | Internal CMMC readiness assessment tool | P1 | 2d | 8.2, 11.1 | CMMC readiness |

### 5.3 Frontend — Phase III

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 12.1 | Executive Dashboard: full KPI widgets, risk chart, open tasks, approvals | P0 | 3d | 10.1, 10.3 | Governance KPI Dashboard |
| 12.2 | Cyber: POA&M management, CMMC readiness view | P0 | 2d | 11.1, 11.3 | Cyber dashboard |
| 12.3 | Subcontractor affirmation portal (external or internal flow) | P1 | 1d | 11.2 | Affirmation UI |

**Phase III Exit Criteria:**
- [ ] Governance KPI Dashboard live with portfolio-wide risk, open tasks, approvals
- [ ] Subcontractor cyber affirmation process deployed
- [ ] Internal CMMC readiness review tool available
- [ ] Funding threshold monitoring active

---

## 6. Phase IV — Enterprise Optimization (Days 270–365)

**Focus:** Prime-grade maturity — risk escalation tracking, cost-reimbursable prep, Annual Report.

### 6.1 Risk & Compliance

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 13.1 | Automated risk escalation tracking (Level 3/4 escalation rules) | P0 | 2d | 6.2 | Risk escalation automation |
| 13.2 | Expand clause library to enterprise depth | P1 | 2d | 2.2 | Expanded library |

### 6.2 Financials — Cost-Reimbursable

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 14.1 | Cost-reimbursable contract accounting structure | P0 | 2d | 3.1, 3.2 | Cost-reimb support |
| 14.2 | Advanced job costing (CPFF, T&M) | P1 | 2d | 14.1 | Advanced costing |

### 6.3 Cyber & Reporting

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 15.1 | Enterprise cyber tabletop simulation support (scenarios, tracking) | P1 | 1d | 8.3 | Cyber tabletop |
| 15.2 | Annual Executive Governance Report generator (PDF export) | P0 | 3d | 10.1, 6.1, 8.2, 2.2 | Annual report |

### 6.4 Admin & Audit

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 16.1 | Admin module: user roles, system settings | P0 | 2d | 4.1 | Admin module |
| 16.2 | Global immutable audit log viewer (read-only, export) | P0 | 1d | 0.7 | Audit log UI |

### 6.5 Frontend — Phase IV

| # | Task | Priority | Effort | Dependencies | Deliverable |
|---|------|----------|--------|--------------|-------------|
| 17.1 | Annual Report generation UI and PDF export | P0 | 1d | 15.2 | Report generator |
| 17.2 | Admin module: user management, audit log viewer | P0 | 1d | 16.1, 16.2 | Admin UI |

**Phase IV Exit Criteria:**
- [ ] Automated risk escalation tracking live
- [ ] Cost-reimbursable contract structure supported
- [ ] Annual Executive Governance Report generator deployed
- [ ] Admin module with audit log viewer operational

---

## 7. Cross-Cutting Tasks

These tasks span multiple phases and should be scheduled alongside feature work.

| # | Task | Priority | Ongoing | Notes |
|---|------|----------|---------|------|
| CC.1 | RBAC enforcement review (audit each new endpoint) | P0 | Yes | Every new API must enforce RBAC |
| CC.2 | Audit logging verification (all mutations logged) | P0 | Yes | Verify user, action, timestamp, delta |
| CC.3 | Security testing (SAST, dependency scan, OWASP) | P1 | Yes | Integrate into CI |
| CC.4 | Terraform: prod infrastructure, KMS, RDS, S3 | P0 | Phase I–II | Align with FISMA/CMMC |
| CC.5 | Load and performance testing | P1 | Phase III–IV | Before prime-grade scale |
| CC.6 | Documentation: API docs (OpenAPI), runbooks | P1 | Ongoing | Keep current |

---

## 8. Risk & Dependency Matrix

### Critical Path
```
Sprint 0 → Contracts (1.x) → Compliance (2.x) → Financials (3.x)
                ↓
         Documents (4.2) → Frontend (5.x)
                ↓
         Risk (6.x) → Cyber (8.x) → Phase III/IV features
```

### Key Dependencies
| Dependent Task | Blocked By |
|----------------|------------|
| Pre-bid workflow (1.6) | Phase advancement (1.4), Risk profile (6.1) |
| Contract detail hub (5.3) | Contracts, Compliance, Financials, Documents APIs |
| 72-hour incident tracker (8.4) | Incident API (8.3), Notifications (4.3) |
| KPI Dashboard (12.1) | KPI API (10.1), all core services |
| Annual Report (15.2) | All services with reporting data |

### Phase Overlap Strategy
- Begin Phase II backend work (6.x, 8.x) in **week 10** of Phase I
- Begin Phase III KPI API (10.1) in **week 16** of Phase II
- Run Phase IV report generator (15.2) in parallel with 13.1, 14.1

---

## Appendix: Task Count Summary

| Phase | Backend Tasks | Frontend Tasks | Total Effort (Est.) |
|-------|---------------|----------------|---------------------|
| Sprint 0 | 7 | 1 | ~17 days |
| Phase I | 15 | 6 | ~25 days |
| Phase II | 9 | 4 | ~17 days |
| Phase III | 5 | 3 | ~12 days |
| Phase IV | 8 | 2 | ~15 days |
| **Total** | **44** | **16** | **~86 dev-days** |

*Effort estimates assume 1 developer; scale team size to compress calendar time.*

---

*This roadmap is traceable to:*
- *GovernancePhilosophy&EnterpriseRiskDoctrine.txt*
- *MacTech_Enterprise_Governance_Execution_Roadmap.pdf*
- *System Architecture & API Specification*
