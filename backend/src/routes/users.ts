import { Router } from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['Level 1', 'Level 2']), async (_req, res) => {
  const result = await query('SELECT id, email, name, role, created_at FROM users ORDER BY name');
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (req.user?.id !== id && !['Level 1', 'Level 2'].includes(req.user?.role ?? '')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  const result = await query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

router.put(
  '/:id',
  authorize(['Level 1']),
  async (req, res) => {
    const { id } = req.params;
    const { role, name } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    if (role !== undefined) {
      updates.push(`role = $${i++}`);
      values.push(role);
    }
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(name);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING id, email, name, role, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  }
);

export default router;
