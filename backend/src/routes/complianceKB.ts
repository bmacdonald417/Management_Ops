import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { retrieveRelevantChunks } from '../services/complianceKB/retrieve.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const RetrieveSchema = z.object({
  query: z.string().min(1),
  filters: z.object({
    docType: z.array(z.string()).optional(),
    category: z.array(z.string()).optional(),
    externalIdPrefix: z.string().optional()
  }).optional(),
  topK: z.number().min(1).max(50).optional()
});

router.post('/retrieve', async (req, res) => {
  const body = RetrieveSchema.parse(req.body);
  const results = await retrieveRelevantChunks(body.query, body.filters ?? {}, body.topK ?? 8);
  res.json({ results });
});

export default router;
