import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ROLES_ORDER = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

function hasRequiredRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
    const decoded = jwt.verify(token, secret) as { sub: string; email?: string; role?: string };
    req.user = {
      id: decoded.sub,
      email: decoded.email ?? decoded.sub,
      role: decoded.role ?? 'Level 5'
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!hasRequiredRole(req.user.role, allowedRoles)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as { sub: string; email?: string; role?: string };
      req.user = {
        id: decoded.sub,
        email: decoded.email ?? decoded.sub,
        role: decoded.role ?? 'Level 5'
      };
    } catch {
      // ignore
    }
  }
  next();
}
