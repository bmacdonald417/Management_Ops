# Legacy Solicitation Workflow — Dependency Map (Deprecated)

The legacy workflow used `solicitation_versions` and `clause_review_entries`. It has been deprecated in favor of the engine: `solicitation_clauses`, `regulatory_clauses` / `unified_clause_master`, and `clause_risk_assessments`.

## Legacy API Endpoints (now return 410 Gone)

| Method | Path | Replacement |
|--------|------|-------------|
| GET | /api/governance/solicitations | GET /api/solicitations |
| POST | /api/governance/solicitations | POST /api/solicitations |
| GET | /api/governance/solicitations/:id | GET /api/solicitations/:id |
| PUT | /api/governance/solicitations/:id | PATCH /api/solicitations/:id |
| POST | /api/governance/solicitations/:id/clauses | POST /api/solicitations/:id/clauses/extract or /manual |
| POST | /api/governance/solicitations/:id/clauses/bulk | POST /api/solicitations/:id/clauses/extract |
| PUT | /api/governance/solicitations/:id/clauses/:clauseId | POST /api/solicitation-clauses/:id/assess |
| POST | /api/governance/solicitations/:id/submit | Engine approve-to-bid flow |
| POST | /api/governance/solicitations/:id/approve | Engine approval flow |
| POST | /api/governance/solicitations/:id/finalize | POST /api/solicitations/:id/approve-to-bid |
| GET | /api/governance/solicitations/:id/audit | GET /api/solicitations/:id (audit via engine) |

## Data Migration

- **Script:** `npm run migrate:legacy-solicitations` (or `migrate:legacy-solicitations:prod` after build).
- **Behavior:** Copies solicitations that have `clause_review_entries` but no `solicitation_clauses` into the engine tables; resolves clause numbers to `regulatory_clauses`; creates `clause_risk_assessments` from legacy risk_level/total_score.
- **DB migration:** `019_legacy_solicitation_archive.sql` adds `deprecated_at` to `solicitation_versions` and `clause_review_entries`.

## Consumers Updated to Engine

- **Governance maturity (GCI):** Reads from `solicitation_clauses` and engine metrics.
- **Auto-builder context:** Reads from `solicitation_clauses` and `clause_risk_assessments`.
- **Risk scoring:** Ingest uses `solicitationRiskEngine.classifyClauseRiskForIngest`; runtime uses `solicitationRiskEngine.assessClauseRisk` only.

## Copilot

PREBID_SCORE_ASSIST and modes that referenced `clause_review_entries` may need to be updated to use `solicitation_clauses` / `clause_risk_assessments` when used with engine solicitations.
