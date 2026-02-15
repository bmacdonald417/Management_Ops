# Railway Deployment

## Database

Uses Railway Postgres with internal hostname (`*.railway.internal`). `DATABASE_URL` is injected by Railway—no local DNS or `.env` required in production. Only the Management_Ops service can reach the DB.

## Start Flow (prodBoot)

1. **Migrations** always run (`node dist/db/migrate.js`).
2. **Ingestion** runs only when `RUN_REG_INGEST=true`.
3. **Server** starts after migrate (and optional ingest).

## Regulatory Files

- `backend/regulatory/part_52.html/` and `part_252.html/` (nested) or flat `part_52.html`, `part_252.html`.
- Build copies to `dist/regulatory/part_52.html`, `dist/regulatory/part_252.html` (flat).
- For DFARS hundreds of clauses: use full acquisition.gov Part 252 (Subpart 252.2), not PGI Part 252.
- Ingestion reads from `dist/regulatory/` or `backend/regulatory/` depending on cwd.

## Regulatory Ingestion

To ingest FAR 52 and DFARS 252 clauses:

1. In Railway → Variables, add `RUN_REG_INGEST=true`.
2. Redeploy the service.
3. Check logs for: `[Ingest] FAR count: X`, `[Ingest] DFARS count: Y`, `Inserted`, `Skipped`.
4. Remove `RUN_REG_INGEST` or set to `false`.
5. Redeploy to return to normal startup.

Ingestion is **not** run on every deploy—only when explicitly requested.

## Scripts

| Script | Use |
|--------|-----|
| `npm start` | prodBoot: migrate → ingest (if flag) → server |
| `npm run reg:ingest:prod` | Ingest only (after build) |
| `npm run db:migrate:prod` | Migrate only |

## Environment

- **DATABASE_URL**: Set by Railway Postgres plugin.
- **RUN_REG_INGEST**: `true` to run ingestion on next deploy.
- Do **not** rely on `backend/.env` in production.
