import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { isAIEnabled, isConfigured } from '../lib/openaiClient.js';
import {
  runClauseEnrich,
  runPrebidClauseExtract,
  runPrebidScoreAssist,
  runExecutiveBrief,
  runAutobuilderSectionHelp,
  NO_COMPLIANCE_SOURCES_FOUND,
  type CopilotMode
} from '../services/copilot/modes.js';

const router = Router();
router.use(authenticate);

const MODES: CopilotMode[] = [
  'CLAUSE_ENRICH',
  'PREBID_CLAUSE_EXTRACT',
  'PREBID_SCORE_ASSIST',
  'EXECUTIVE_BRIEF',
  'AUTOBUILDER_SECTION_HELP'
];

function canRunMode(role: string, mode: CopilotMode): boolean {
  switch (mode) {
    case 'CLAUSE_ENRICH':
    case 'PREBID_SCORE_ASSIST':
      return ['Level 1', 'Level 2', 'Level 3'].includes(role);
    case 'PREBID_CLAUSE_EXTRACT':
    case 'EXECUTIVE_BRIEF':
      return true;
    case 'AUTOBUILDER_SECTION_HELP':
      return ['Level 1', 'Level 2', 'Level 3'].includes(role);
    default:
      return false;
  }
}

async function logCopilotAudit(actorId: string, mode: string, relatedId?: string): Promise<void> {
  const entityId = randomUUID();
  await query(
    `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ['AI_COPILOT', entityId, 'CREATE', 'reason', null, `MODE: ${mode}`, actorId]
  );
}

async function storeCopilotRun(
  mode: string,
  payload: unknown,
  result: unknown,
  citationsJson: unknown[],
  actorId: string,
  entityType: string,
  entityId?: string
): Promise<string> {
  const r = await query(
    `INSERT INTO copilot_runs (mode, payload_json, result_json, citations_json, actor_id, related_entity_id, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      mode,
      JSON.stringify(payload),
      JSON.stringify(result),
      JSON.stringify(citationsJson),
      actorId,
      entityId ?? null,
      entityType,
      entityId ?? null
    ]
  );
  return (r.rows[0] as { id: string }).id;
}

const runSchema = z.object({
  mode: z.enum(MODES as [string, ...string[]]),
  payload: z.record(z.unknown())
});

router.post('/run', async (req, res) => {
  if (!isAIEnabled() || !isConfigured()) {
    return res.status(503).json({
      error: 'AI is not configured. Set AI_FEATURES_ENABLED=true and OPENAI_API_KEY in Railway → Variables.',
      configured: false
    });
  }

  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { mode, payload } = parsed.data;
  const user = req.user!;

  if (!canRunMode(user.role, mode as CopilotMode)) {
    return res.status(403).json({ error: 'Insufficient permissions for this copilot mode' });
  }

  const p = payload as { solicitationId?: string; clauseId?: string };
  const entityId = p.solicitationId ?? p.clauseId;
  const entityType = p.solicitationId ? 'Solicitation' : p.clauseId ? 'ClauseLibraryItem' : 'Unknown';

  logCopilotAudit(user.id, mode, entityId).catch((e) => console.error('Copilot audit failed:', e));

  try {
    let runResult;
    switch (mode) {
      case 'CLAUSE_ENRICH':
        runResult = await runClauseEnrich(payload as { clauseNumber?: string; clauseId?: string });
        break;
      case 'PREBID_CLAUSE_EXTRACT':
        runResult = await runPrebidClauseExtract(payload as { solicitationId: string; rawText: string });
        break;
      case 'PREBID_SCORE_ASSIST':
        runResult = await runPrebidScoreAssist(payload as { solicitationId: string; clauseEntryIds: string[] });
        break;
      case 'EXECUTIVE_BRIEF':
        runResult = await runExecutiveBrief(payload as { solicitationId: string });
        break;
      case 'AUTOBUILDER_SECTION_HELP':
        runResult = await runAutobuilderSectionHelp(payload as { sectionId: string; contextSnapshot?: string });
        break;
      default:
        return res.status(400).json({ error: 'Unknown mode' });
    }

    if (runResult.errorCode === NO_COMPLIANCE_SOURCES_FOUND) {
      const runId = await storeCopilotRun(
        mode,
        payload,
        { error: runResult.error },
        runResult.citations,
        user.id,
        entityType,
        entityId
      );
      return res.status(422).json({
        runId,
        success: false,
        error: NO_COMPLIANCE_SOURCES_FOUND,
        message: 'No indexed compliance sources available.',
        citations: []
      });
    }

    const runId = await storeCopilotRun(
      mode,
      payload,
      runResult.success ? runResult.result : { error: runResult.error },
      runResult.citations,
      user.id,
      entityType,
      entityId
    );

    res.json({
      runId,
      success: runResult.success,
      result: runResult.result,
      citations: runResult.citations,
      error: runResult.error
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Copilot run failed';
    console.error('Copilot run error:', err);
    res.status(500).json({ error: msg });
  }
});

// Apply (human-in-the-loop) — Quality/SysAdmin only
router.post(
  '/apply',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const body = z.object({
      type: z.enum(['clause-enrich', 'score-assist']),
      copilotRunId: z.string().uuid().optional(),
      clauseId: z.string().uuid().optional(),
      suggestedType: z.string().optional(),
      suggestedCategory: z.string().optional(),
      defaultScores: z.record(z.number()).optional(),
      suggestedRiskLevel: z.string().optional(),
      flowDown: z.string().optional(),
      mitigationStrategy: z.string().optional(),
      notes: z.string().optional(),
      updates: z.array(z.object({
        clauseEntryId: z.string().uuid(),
        financial_dim: z.number().min(1).max(5).optional(),
        cyber_dim: z.number().min(1).max(5).optional(),
        liability_dim: z.number().min(1).max(5).optional(),
        regulatory_dim: z.number().min(1).max(5).optional(),
        performance_dim: z.number().min(1).max(5).optional(),
        risk_level: z.number().min(1).max(4).optional(),
        escalation_trigger: z.boolean().optional(),
        notes: z.string().optional()
      })).optional()
    }).parse(req.body);

    if (body.type === 'clause-enrich' && body.clauseId) {
      const updates: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      if (body.suggestedType) { updates.push(`type = $${i++}`); values.push(body.suggestedType); }
      if (body.suggestedCategory) { updates.push(`category = $${i++}`); values.push(body.suggestedCategory); }
      if (body.suggestedRiskLevel) {
        const lvl = parseInt(String(body.suggestedRiskLevel).replace('L', ''), 10);
        if (lvl >= 1 && lvl <= 4) { updates.push(`suggested_risk_level = $${i++}`); values.push(lvl); }
      }
      if (body.flowDown) { updates.push(`flow_down = $${i++}`); values.push(body.flowDown); }
      if (body.notes !== undefined || body.mitigationStrategy) {
        const append = [body.notes, body.mitigationStrategy ? `Mitigation: ${body.mitigationStrategy}` : ''].filter(Boolean).join('\n');
        updates.push(`notes = COALESCE(notes,'') || $${i++}`);
        values.push('\n' + append);
      }
      if (body.defaultScores) {
        if (body.defaultScores.financial !== undefined) { updates.push(`default_financial = $${i++}`); values.push(body.defaultScores.financial); }
        if (body.defaultScores.cyber !== undefined) { updates.push(`default_cyber = $${i++}`); values.push(body.defaultScores.cyber); }
        if (body.defaultScores.liability !== undefined) { updates.push(`default_liability = $${i++}`); values.push(body.defaultScores.liability); }
        if (body.defaultScores.regulatory !== undefined) { updates.push(`default_regulatory = $${i++}`); values.push(body.defaultScores.regulatory); }
        if (body.defaultScores.performance !== undefined) { updates.push(`default_performance = $${i++}`); values.push(body.defaultScores.performance); }
      }
      if (updates.length === 0) return res.status(400).json({ error: 'No fields to apply' });
      updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
      values.push(req.user!.id, body.clauseId);
      await query(`UPDATE clause_library_items SET ${updates.join(', ')} WHERE id = $${i}`, values);
      await query(
        `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['ClauseLibraryItem', body.clauseId, 'UPDATE', 'copilot_apply', body.copilotRunId ?? null, 'clause_enrich', req.user!.id]
      );
      return res.json({ success: true });
    }

    if (body.type === 'score-assist' && body.updates?.length) {
      for (const u of body.updates) {
        const allowed = ['financial_dim', 'cyber_dim', 'liability_dim', 'regulatory_dim', 'performance_dim', 'risk_level', 'escalation_trigger', 'notes'];
        const sets: string[] = [];
        const vals: unknown[] = [];
        let i = 1;
        for (const k of allowed) {
          const v = u[k as keyof typeof u];
          if (v !== undefined) {
            sets.push(`${k} = $${i++}`);
            vals.push(v);
          }
        }
        if (sets.length > 0) {
          sets.push('updated_at = NOW()');
          vals.push(u.clauseEntryId);
          await query(`UPDATE clause_review_entries SET ${sets.join(', ')} WHERE id = $${i}`, vals);
          await query(
            `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ['ClauseEntry', u.clauseEntryId, 'UPDATE', 'copilot_apply', body.copilotRunId ?? null, 'score_assist', req.user!.id]
          );
        }
      }
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid apply request' });
  }
);

// Legacy apply endpoints (delegate to unified)
router.post(
  '/apply/clause-enrich',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const body = z.object({
      clauseId: z.string().uuid(),
      suggestedType: z.string().optional(),
      suggestedCategory: z.string().optional(),
      defaultScores: z.object({
        financial: z.number().min(1).max(5).optional(),
        cyber: z.number().min(1).max(5).optional(),
        liability: z.number().min(1).max(5).optional(),
        regulatory: z.number().min(1).max(5).optional(),
        performance: z.number().min(1).max(5).optional()
      }).optional(),
      suggestedRiskLevel: z.string().optional(),
      flowDown: z.string().optional(),
      mitigationStrategy: z.string().optional(),
      notes: z.string().optional()
    }).parse(req.body);

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.suggestedType) { updates.push(`type = $${i++}`); values.push(body.suggestedType); }
    if (body.suggestedCategory) { updates.push(`category = $${i++}`); values.push(body.suggestedCategory); }
    if (body.suggestedRiskLevel) {
      const lvl = parseInt(body.suggestedRiskLevel.replace('L', ''), 10);
      if (lvl >= 1 && lvl <= 4) { updates.push(`suggested_risk_level = $${i++}`); values.push(lvl); }
    }
    if (body.flowDown) { updates.push(`flow_down = $${i++}`); values.push(body.flowDown); }
    if (body.notes !== undefined || body.mitigationStrategy) {
      const append = [body.notes, body.mitigationStrategy ? `Mitigation: ${body.mitigationStrategy}` : ''].filter(Boolean).join('\n');
      updates.push(`notes = COALESCE(notes,'') || $${i++}`);
      values.push('\n' + append);
    }
    if (body.defaultScores) {
      if (body.defaultScores.financial !== undefined) { updates.push(`default_financial = $${i++}`); values.push(body.defaultScores.financial); }
      if (body.defaultScores.cyber !== undefined) { updates.push(`default_cyber = $${i++}`); values.push(body.defaultScores.cyber); }
      if (body.defaultScores.liability !== undefined) { updates.push(`default_liability = $${i++}`); values.push(body.defaultScores.liability); }
      if (body.defaultScores.regulatory !== undefined) { updates.push(`default_regulatory = $${i++}`); values.push(body.defaultScores.regulatory); }
      if (body.defaultScores.performance !== undefined) { updates.push(`default_performance = $${i++}`); values.push(body.defaultScores.performance); }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to apply' });
    updates.push(`updated_at = NOW()`, `updated_by = $${i++}`);
    values.push(req.user!.id);
    values.push(body.clauseId);

    await query(
      `UPDATE clause_library_items SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    await query(
      `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['ClauseLibraryItem', body.clauseId, 'UPDATE', 'copilot_apply', null, 'clause_enrich', req.user!.id]
    );
    res.json({ success: true });
  }
);

// Apply score assist (human-in-the-loop) — Quality/SysAdmin only
router.post(
  '/apply/score-assist',
  authorize(['Level 1', 'Level 3']),
  async (req, res) => {
    const body = z.object({
      updates: z.array(z.object({
        clauseEntryId: z.string().uuid(),
        financial_dim: z.number().min(1).max(5).optional(),
        cyber_dim: z.number().min(1).max(5).optional(),
        liability_dim: z.number().min(1).max(5).optional(),
        regulatory_dim: z.number().min(1).max(5).optional(),
        performance_dim: z.number().min(1).max(5).optional(),
        risk_level: z.number().min(1).max(4).optional(),
        escalation_trigger: z.boolean().optional(),
        notes: z.string().optional()
      }))
    }).parse(req.body);

    for (const u of body.updates) {
      const allowed = ['financial_dim', 'cyber_dim', 'liability_dim', 'regulatory_dim', 'performance_dim', 'risk_level', 'escalation_trigger', 'notes'];
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      for (const k of allowed) {
        const v = u[k as keyof typeof u];
        if (v !== undefined) {
          sets.push(`${k} = $${i++}`);
          vals.push(v);
        }
      }
      if (sets.length > 0) {
        sets.push('updated_at = NOW()');
        vals.push(u.clauseEntryId);
        await query(`UPDATE clause_review_entries SET ${sets.join(', ')} WHERE id = $${i}`, vals);
        await query(
          `INSERT INTO governance_audit_events (entity_type, entity_id, action, field_name, old_value, new_value, actor_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['ClauseEntry', u.clauseEntryId, 'UPDATE', 'copilot_apply', null, 'score_assist', req.user!.id]
        );
      }
    }
    res.json({ success: true });
  }
);

export default router;
