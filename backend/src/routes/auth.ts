import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
  const result = await query(
    'SELECT id, email, name, role FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = result.rows[0] as { id: string; email: string; name: string; role: string } | undefined;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/dev-token', async (req, res) => {
  const allowInProd = process.env.ALLOW_DEV_TOKEN === '1' || process.env.ALLOW_DEV_TOKEN === 'true';
  if (process.env.NODE_ENV === 'production' && !allowInProd) {
    return res.status(403).json({ error: 'Not available in production. Set ALLOW_DEV_TOKEN=1 for initial setup only.' });
  }
  const result = await query('SELECT id, email, name, role FROM users WHERE role = $1 LIMIT 1', ['Level 1']);
  const user = result.rows[0] as { id: string; email: string; name: string; role: string } | undefined;
  if (!user) {
    return res.status(404).json({ error: 'No dev user found. Run db:seed first.' });
  }
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
