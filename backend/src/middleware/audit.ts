import { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';

export function auditLog(entityType: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const userId = req.user?.id ?? null;
      const entityId = (req.params?.id ?? (body as { id?: string })?.id) ?? null;
      const payload = {
        method: req.method,
        path: req.path,
        body: req.body,
        result: body
      };
      query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, entityType, entityId, JSON.stringify(payload)]
      ).catch((err) => console.error('Audit log failed:', err));
      return originalJson(body);
    };
    next();
  };
}
