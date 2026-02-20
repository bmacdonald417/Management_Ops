# Testing — Post-consolidation

## Regression and validation checklist

### Backend

- **Legacy migration:** Run `npm run migrate:legacy-solicitations` (or prod script) against a DB with legacy `clause_review_entries`; verify `solicitation_clauses` and `clause_risk_assessments` are created and solicitation status updated.
- **Governance routes:** GET/POST /api/governance/solicitations and related legacy endpoints return 410 with body `{ migrated: true, use: '/api/solicitations' }`.
- **GCI / Maturity:** GET /api/governance/maturity returns metrics computed from `solicitation_clauses` and `clause_risk_assessments` (no dependency on `clause_review_entries`).
- **Auto-builder context:** GET /api/governance/auto-builder/context returns section stats using engine tables only.
- **Risk ingest:** Regulatory ingest uses `solicitationRiskEngine.classifyClauseRiskForIngest`; `regulatory_clauses` and `unified_clause_master` get risk_category, risk_score, flow_down.
- **Approve-to-bid blockers:** GET /api/solicitations/:id/approve-to-bid/blockers returns `actionSolicitationClauseId` for UNASSESSED_CLAUSES and FLOWDOWN_REVIEW_PENDING when applicable.
- **Clause SSOT validation:** GET /api/admin/clause-ssot-validation (admin only) returns consistency check for regulatory_clauses vs unified_clause_master.

### Frontend

- **Navigation:** Single top-level nav with Pre-Bid dropdown and Admin dropdown (Admin visible only for Level 1/3).
- **Solicitations list:** Uses only GET /api/solicitations; no legacy merge; single "New solicitation" CTA to engine new flow.
- **Admin guard:** Direct navigation to /admin/* redirects to / for users without Level 1 or Level 3.
- **Onboarding:** /onboarding shows steps; "Finish" sets localStorage and navigates to /; Dashboard shows "Start setup" when not completed.
- **Empty states:** Contracts, Financials, Reports, Admin Compliance Registry, Login show user-friendly copy (no "db:seed").
- **Approve-to-bid:** Blockers list shows "Resolve" link when `actionSolicitationClauseId` is present; link goes to assess page for that clause.

### Manual / E2E

- Create solicitation (engine) → extract clauses → assess → approve → approve-to-bid; verify blockers and Resolve deep-link.
- Run clause SSOT validation after ingest and migrateClauseData; fix any reported errors.
