/**
 * Phase 4: QMS API routes for form templates (cross-database integration).
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { qmsListFormTemplates } from '../services/qmsClient.js';

const router = Router();
router.use(authenticate);

// GET /api/qms/form-templates — list form templates from QMS (e.g. documents tagged as form-template)
router.get(
  '/form-templates',
  authorize(['Level 1', 'Level 2', 'Level 3', 'Level 4']),
  async (_req, res) => {
    const templates = await qmsListFormTemplates();
    res.json({ templates });
  }
);

export default router;
