import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../lib/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---- Types ----

export type UserType = 'company' | 'candidate';

export interface AuthPayload {
  userId: string;
  companyId: string;
  role: string;
  email: string;
  userType: UserType;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ---- JWT Helpers ----

/**
 * Generate a JWT token for a user (company or candidate).
 */
export function generateToken(payload: AuthPayload, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

// ---- Middlewares ----

/**
 * JWT authentication middleware.
 * Extracts and validates the Bearer token from the Authorization header.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    logger.warn({ err }, 'Invalid JWT token');
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Authenticate only company users.
 */
export function authenticateCompany(req: AuthRequest, res: Response, next: NextFunction): void {
  authenticate(req, res, () => {
    if (req.user?.userType !== 'company') {
      res.status(403).json({ success: false, error: 'Company access only' });
      return;
    }
    next();
  });
}

/**
 * Authenticate only candidate users.
 */
export function authenticateCandidate(req: AuthRequest, res: Response, next: NextFunction): void {
  authenticate(req, res, () => {
    if (req.user?.userType !== 'candidate') {
      res.status(403).json({ success: false, error: 'Candidate access only' });
      return;
    }
    next();
  });
}

/**
 * Role-based authorization middleware.
 * Must be used after authenticate().
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
