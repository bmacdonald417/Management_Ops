import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import contractsRouter from './routes/contracts.js';
import complianceRouter from './routes/compliance.js';
import clauseLibraryRouter from './routes/clauseLibrary.js';
import financialsRouter from './routes/financials.js';
import riskRouter from './routes/risk.js';
import cyberRouter from './routes/cyber.js';
import usersRouter from './routes/users.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import governanceRouter from './routes/governance.js';
import solicitationEngineRouter from './routes/solicitationEngine.js';
import solicitationClausesRouter from './routes/solicitationClauses.js';
import completenessRouter from './routes/completeness.js';
import adminRouter from './routes/admin.js';
import complianceKBRouter from './routes/complianceKB.js';
import aiRouter from './routes/ai.js';
import copilotRouter from './routes/copilot.js';
import signaturesRouter from './routes/signatures.js';
import proposalsRouter from './routes/proposals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/compliance', clauseLibraryRouter);
app.use('/api/compliance', complianceKBRouter);
app.use('/api/financials', financialsRouter);
app.use('/api/risk', riskRouter);
app.use('/api/cyber', cyberRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/governance', governanceRouter);
app.use('/api/solicitations', solicitationEngineRouter);
app.use('/api/solicitation-clauses', solicitationClausesRouter);
app.use('/api/completeness', completenessRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);
app.use('/api/copilot', copilotRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/proposals', proposalsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'MacTech Governance Platform' });
});

// Serve frontend static files in production (Railway, etc.)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation error', details: err });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`MacTech Governance API running at http://localhost:${PORT}`);
});
