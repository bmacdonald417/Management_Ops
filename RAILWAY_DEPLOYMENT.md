# Railway Deployment Guide
## MacTech Governance Platform

Deploy from [GitHub: bmacdonald417/Management_Ops](https://github.com/bmacdonald417/Management_Ops.git)

---

## 1. Push Code to GitHub

```bash
cd "c:\Users\bmacd\.cursor\Managment Ops"
git init
git remote add origin https://github.com/bmacdonald417/Management_Ops.git
git add .
git commit -m "Initial commit: MacTech Governance Platform"
git branch -M main
git push -u origin main
```

---

## 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in (GitHub recommended).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select **bmacdonald417/Management_Ops** (or connect the repo if not listed).
4. Railway will detect the project and use `nixpacks.toml` for the build.

---

## 3. Add PostgreSQL

1. In your Railway project, click **+ New**.
2. Select **Database** → **Add PostgreSQL**.
3. Railway creates a PostgreSQL instance and provides `DATABASE_URL` as a variable.
4. The app service will automatically get `DATABASE_URL` if both are in the same project.

---

## 4. Configure Environment Variables

In your **app service** → **Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Auto-injected if PostgreSQL is in same project | ✅ |
| `JWT_SECRET` | A strong random string (e.g. `openssl rand -hex 32`) | ✅ |
| `ALLOW_DEV_TOKEN` | `1` (optional) — Enables dev-token login for initial setup. Remove after configuring Auth0/Cognito. | — |
| `NODE_ENV` | `production` | Auto-set by Railway |

If PostgreSQL is in the same project, `DATABASE_URL` is usually linked automatically. Otherwise, copy it from the PostgreSQL service and paste it into your app variables.

---

## 5. Run Migrations & Seed (One-time)

After the first deploy, run migrations and seed via Railway CLI or a one-off command:

**Option A: Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway link   # Select your project
railway run npm run db:migrate
railway run npm run db:seed
```

**Option B: Railway Dashboard**

1. Open your app service.
2. Go to **Settings** → **Deploy**.
3. Add a custom start command that runs migrate and seed before starting (not recommended for repeated deploys).
4. Or use **Run Command** in the service (if available) to execute `npm run db:migrate` and `npm run db:seed` once.

**Option C: Add migrate/seed to build (temporary)**

You can add migration to the Nixpacks build phase for the initial deploy, then remove it:

```toml
[phases.build]
cmds = [
  "cd backend && npm run build",
  "cd frontend && npm run build",
  "mkdir -p backend/public",
  "cp -r frontend/dist/* backend/public/",
  "cd backend && npm run db:migrate || true",
  "cd backend && npm run db:seed || true"
]
```

Use this only for the first deploy; after that, remove the migrate/seed lines to avoid re-running seeds on every build.

---

## 6. Generate Domain

1. In your app service, go to **Settings** → **Networking**.
2. Click **Generate Domain**.
3. Your app will be available at `https://your-app.up.railway.app`.

---

## 7. Disable Dev Token in Production

The `POST /api/auth/dev-token` endpoint is disabled when `NODE_ENV=production`. For production login:

- Implement Auth0 or AWS Cognito.
- Or add a production login flow that validates credentials against your `users` table and issues JWTs.

---

## Build & Deploy Flow

Railway uses `nixpacks.toml` to:

1. **Install** dependencies for root, backend, and frontend.
2. **Build** backend (TypeScript), frontend (Vite), and copy `frontend/dist` to `backend/public`.
3. **Start** the backend with `node dist/index.js`, which serves the API and the React SPA.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Check Railway logs; ensure all `package.json` scripts and paths are correct. |
| 503 / App won't start | Verify `PORT` is used (Railway sets it automatically). |
| DB connection refused | Ensure `DATABASE_URL` is set and PostgreSQL is running in the same project. |
| Blank page after login | Ensure frontend API client uses relative `/api` (no hardcoded localhost). |
| Migrations fail | Run `railway run npm run db:migrate` manually after first deploy. |
