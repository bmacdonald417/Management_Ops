import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import {
  getOpenAIClient,
  assertAIEnabled,
  isAIEnabled,
  isConfigured,
  getOpenAIModel
} from '../lib/openaiClient.js';

const router = Router();

const PURPOSE_EXPLAIN = ['clause_explanation', 'proposal_draft', 'manual_section', 'general'] as const;
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 8000;
const MAX_TOTAL_CHARS = 40000;

const chatBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().max(MAX_CHARS_PER_MESSAGE)
  })).min(1).max(MAX_MESSAGES),
  temperature: z.number().min(0).max(2).optional().default(0.2),
  purpose: z.enum(PURPOSE_EXPLAIN)
});

function canUsePurpose(role: string, purpose: string): boolean {
  const elevated = ['proposal_draft', 'manual_section'];
  if (elevated.includes(purpose)) {
    return ['Level 1', 'Level 2', 'Level 3'].includes(role);
  }
  return true; // clause_explanation, general: all authenticated
}

async function logAIAudit(actorId: string, purpose: string): Promise<void> {
  const entityId = randomUUID();
  await query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ['AI', entityId, 'CREATE', 'purpose', null, purpose, actorId]
  );
}

router.get('/status', (_req, res) => {
  res.json({
    enabled: isAIEnabled(),
    configured: isConfigured(),
    model: getOpenAIModel()
  });
});

router.post('/chat', authenticate, async (req, res) => {
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'AI is not configured. Set AI_FEATURES_ENABLED=true and OPENAI_API_KEY in Railway → Variables, then redeploy.' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'AI is not configured. Set OPENAI_API_KEY in Railway → Variables, then redeploy.' });
  }

  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
  }

  const { messages, temperature, purpose } = parsed.data;
  const user = req.user!;

  if (!canUsePurpose(user.role, purpose)) {
    return res.status(403).json({ error: 'Insufficient permissions for this AI purpose' });
  }

  const totalChars = messages.reduce((s, m) => s + (m.content?.length ?? 0), 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({ error: `Request too large. Max ${MAX_TOTAL_CHARS} characters total.` });
  }

  const client = getOpenAIClient();
  if (!client) {
    return res.status(503).json({ error: 'AI is not configured. Set OPENAI_API_KEY in Railway → Variables, then redeploy.' });
  }

  try {
    assertAIEnabled();
  } catch {
    return res.status(503).json({ error: 'AI is not configured. Set OPENAI_API_KEY in Railway → Variables, then redeploy.' });
  }

  logAIAudit(user.id, purpose).catch((e) => console.error('AI audit log failed:', e));

  try {
    const completion = await client.chat.completions.create({
      model: getOpenAIModel(),
      messages: messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
      temperature,
      max_tokens: 4096
    });

    const choice = completion.choices[0];
    const reply = choice?.message?.content ?? '';
    const usage = completion.usage ? {
      prompt_tokens: completion.usage.prompt_tokens,
      completion_tokens: completion.usage.completion_tokens,
      total_tokens: completion.usage.total_tokens
    } : undefined;

    res.json({
      reply,
      modelUsed: completion.model ?? getOpenAIModel(),
      usage
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed';
    if (msg.includes('API key') || msg.includes('authentication')) {
      return res.status(503).json({ error: 'AI is not configured. Check OPENAI_API_KEY in Railway → Variables.' });
    }
    console.error('OpenAI chat error:', err);
    res.status(502).json({ error: 'AI request failed. Please try again.' });
  }
});

export default router;
