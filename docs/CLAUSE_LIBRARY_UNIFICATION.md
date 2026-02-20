# Phase 1: Clause Library Unification

## Summary

The platform consolidates clause data into a single source of truth: **unified_clause_master** (and optional **unified_clause_versions**). The following tables are **deprecated** for new reads/writes in the Governance Engine and Clause Library flows; they remain in the schema for backward compatibility and will be removed in a future phase.

### Deprecated tables (do not use for new logic)

| Table | Status | Notes |
|-------|--------|--------|
| **regulatory_clauses** | Deprecated | Replaced by unified_clause_master. Still populated by ingestRegulations; engine and clauseService prefer unified. |
| **clause_library_items** | Deprecated | Overlay data merged into unified_clause_master (override_* columns). Writes still sync to both during transition. |
| **compliance_clauses** | Deprecated | Legacy contract-clause link only. contract_clauses still references it; new clause data uses unified. |
| **clause_master** (003) | Deprecated | Compliance registry import staging. Migrated into unified_clause_master; registry can be updated to write to unified later. |

### New canonical tables

| Table | Purpose |
|-------|--------|
| **unified_clause_master** | Single row per (regulation, clause_number). Base + overlay columns. |
| **unified_clause_versions** | Optional version history (version, effective_date, summary_of_changes). |

### Migration steps (already applied in codebase)

1. **014_unified_clause_library.sql** — Creates unified_clause_master and unified_clause_versions.
2. **015_unified_clause_fk.sql** — Adds solicitation_clauses.unified_clause_master_id, backfill from regulatory_clauses.
3. **migrateClauseData.ts** — Run once after 014/015: `npm run migrate:clauses` (in backend). Populates unified from all four sources and backfills solicitation_clauses.unified_clause_master_id.
4. **clauseService** — Reads from unified_clause_master first, falls back to regulatory_clauses + clause_library_items.
5. **Routes** — solicitationEngine, solicitationClauses, clauseLibrary, workflowEngine, clauseAssessmentFormBuilder use unified_clause_master_id where present.

### Run order for new environments

1. `npm run db:migrate` (runs 014, 015).
2. `npm run migrate:clauses` (populates unified_clause_master and backfills solicitation_clauses).
3. Optionally `npm run reg:ingest` (also upserts into unified_clause_master).

### Idempotency

- **migrateClauseData.ts** is idempotent: safe to run multiple times; uses ON CONFLICT (regulation, clause_number) DO UPDATE for unified_clause_master.
