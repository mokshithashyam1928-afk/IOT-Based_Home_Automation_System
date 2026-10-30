import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nexushome-sern-sqa-secret-key-2026';

export interface JwtUserPayload {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtUserPayload {
  return jwt.verify(token, JWT_SECRET) as JwtUserPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or malformed Bearer token',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired JWT token',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
}

export function requireRole(roles: Array<'ADMIN' | 'USER'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires role ${roles.join(' or ')}`,
        code: 'ROLE_FORBIDDEN'
      });
    }
    next();
  };
}
