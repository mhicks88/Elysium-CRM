import { Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/service';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    console.log(JSON.stringify({ level: 'warn', message: 'Missing authorization header', path: req.originalUrl }));
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
    email: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing authorization header' } });
    return;
  }

  const token = header.replace('Bearer ', '');
  const user = await authService.getUserFromToken(token);
  if (!user) {
    console.log(JSON.stringify({ level: 'warn', message: 'Invalid token', path: req.originalUrl }));
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    return;
  }

  req.user = {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName
  };
  next();
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthenticatedRequest['user'];
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing authorization header' } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
      return;
    }
    next();
  };
}
