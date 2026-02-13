# MacTech Enterprise Federal Governance & Risk Management Platform

Enterprise-grade, audit-ready Federal Contract Governance & Risk Management Platform for MacTech Solutions LLC.

**Repository:** [github.com/bmacdonald417/Management_Ops](https://github.com/bmacdonald417/Management_Ops)

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Database

Create a PostgreSQL database:

```sql
CREATE DATABASE mactech_governance;
```

Copy the backend environment file and configure:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set `DATABASE_URL` if needed (default: `postgresql://postgres:postgres@localhost:5432/mactech_governance`).

### 3. Run Migrations

```bash
npm run db:migrate
```

### 4. Seed Data (FAR/DFARS clauses, CMMC controls, dev user, sample contract)

```bash
npm run db:seed
```

### 5. Start Development Servers

```bash
npm run dev
```

This starts:
- **Backend API** at http://localhost:3000
- **Frontend** at http://localhost:5173

### 6. Sign In

1. Open http://localhost:5173
2. Click **Sign in (Dev)** — uses the seeded admin user (`admin@mactech.local`)

## Project Structure

```
├── backend/           # Express API
│   ├── src/
│   │   ├── db/        # Schema, migrations, seeds
│   │   ├── middleware/
│   │   └── routes/
│   └── package.json
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── api/
│   └── package.json
├── Sources/           # Reference data (FAR, DFARS, NIST 800-171 CSVs)
└── Implementation_Roadmap_MacTech_Governance_Platform.md
```

## API Endpoints

| Service | Endpoints |
|---------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/dev-token` |
| Contracts | `GET/POST /api/contracts`, `GET/PUT/DELETE /api/contracts/:id`, `POST /api/contracts/:id/phases` |
| Compliance | `GET /api/compliance/library`, `GET/POST/PUT /api/compliance/contracts/:id/clauses` |
| Financials | `GET/POST /api/financials/rates`, `GET/POST /api/financials/contracts/:id/costs` |
| Risk | `GET /api/risk/profiles/:id`, `POST /api/risk/profiles`, `PUT /api/risk/profiles/:id`, `POST /api/risk/escalations` |
| Cyber | `GET /api/cyber/cmmc/controls`, `GET /api/cyber/contracts/:id/cmmc`, `GET/POST/PUT /api/cyber/incidents` |
| Dashboard | `GET /api/dashboard/kpis` |

## RBAC Roles

- **Level 1** — Sole Managing Member (full access)
- **Level 2** — Authorized Manager
- **Level 3** — Quality/Compliance Oversight
- **Level 4** — Program Execution Authority
- **Level 5** — Administrative Support

## Deployment (Railway)

See **[RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)** for full instructions. Summary:

1. Push to GitHub: `bmacdonald417/Management_Ops`
2. Create Railway project from GitHub repo
3. Add PostgreSQL database
4. Set `JWT_SECRET` and `DATABASE_URL`
5. Run migrations and seed (one-time)
6. Generate a public domain

## Documentation

- [Implementation Roadmap](./Implementation_Roadmap_MacTech_Governance_Platform.md)
- [Supplemental Data Integration](./Sources/SUPPLEMENTAL_CURSOR_PROMPT_Data_Integration.md)
- [System Architecture & API](./Sources/system_architecture_and_api.md)
