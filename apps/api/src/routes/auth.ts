import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { generateToken, authenticate, type AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

const router = Router();

// ---- Validation Schemas ----

const registerSchema = z.object({
  companyName: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  googleId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  companyName: z.string().min(2).max(255).optional(),
});

const candidateLoginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});

// ---- Company Auth Routes ----

/**
 * POST /api/auth/register
 * Register a new company + admin user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { companyName, email, password, name } = registerSchema.parse(req.body);

    // Check if user already exists
    const existing = await prisma.companyUser.findFirst({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Create company + admin user in a transaction
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: companyName, slug: `${slug}-${Date.now()}` },
      });

      const user = await tx.companyUser.create({
        data: {
          companyId: company.id,
          email,
          name,
          role: 'owner',
          passwordHash,
        },
      });

      return { company, user };
    });

    const token = generateToken({
      userId: result.user.id,
      companyId: result.company.id,
      role: result.user.role,
      email: result.user.email,
      userType: 'company',
    });

    logger.info({ companyId: result.company.id, email }, 'New company registered');

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
        company: {
          id: result.company.id,
          name: result.company.name,
          slug: result.company.slug,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

/**
 * POST /api/auth/login
 * Authenticate a company user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.companyUser.findFirst({
      where: { email },
      include: { company: true },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      userType: 'company',
    });

    logger.info({ userId: user.id, email }, 'Company user logged in');

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

/**
 * POST /api/auth/google
 * Google OAuth — creates or finds company user
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { googleId, email, name, avatarUrl, companyName } = googleAuthSchema.parse(req.body);

    // Check if user already exists with this googleId
    let user = await prisma.companyUser.findUnique({
      where: { googleId },
      include: { company: true },
    });

    if (!user) {
      // Check if email already exists (link Google to existing account)
      const existingByEmail = await prisma.companyUser.findFirst({
        where: { email },
        include: { company: true },
      });

      if (existingByEmail) {
        // Link Google account to existing user
        user = await prisma.companyUser.update({
          where: { id: existingByEmail.id },
          data: { googleId, avatarUrl },
          include: { company: true },
        });
      } else {
        // New user — must provide company name to create company
        if (!companyName) {
          res.status(400).json({
            success: false,
            error: 'Company name required for new Google sign-up',
            needsCompanyName: true,
          });
          return;
        }

        const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const result = await prisma.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: { name: companyName, slug: `${slug}-${Date.now()}` },
          });

          const newUser = await tx.companyUser.create({
            data: {
              companyId: company.id,
              email,
              name,
              role: 'owner',
              googleId,
              avatarUrl,
            },
            include: { company: true },
          });

          return newUser;
        });

        user = result;
      }
    }

    const token = generateToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      userType: 'company',
    });

    logger.info({ userId: user.id, email, method: 'google' }, 'Google OAuth login');

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

// ---- Candidate Auth Routes ----

/**
 * POST /api/auth/candidate/login
 * Candidate logs in with generated loginId + password
 */
router.post('/candidate/login', async (req: Request, res: Response) => {
  try {
    const { loginId, password } = candidateLoginSchema.parse(req.body);

    const candidate = await prisma.candidate.findUnique({
      where: { loginId },
      include: { company: true },
    });

    if (!candidate || !candidate.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check expiry
    if (candidate.expiresAt && new Date() > candidate.expiresAt) {
      res.status(401).json({ success: false, error: 'Login credentials have expired' });
      return;
    }

    const valid = await bcrypt.compare(password, candidate.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: candidate.id,
      companyId: candidate.companyId,
      role: 'candidate',
      email: candidate.email,
      userType: 'candidate',
    });

    logger.info({ candidateId: candidate.id, email: candidate.email }, 'Candidate logged in');

    res.json({
      success: true,
      data: {
        token,
        candidate: {
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          company: candidate.company.name,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

// ---- Protected Routes ----

/**
 * GET /api/auth/me
 * Get current user info (company or candidate)
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  if (req.user!.userType === 'candidate') {
    const candidate = await prisma.candidate.findUnique({
      where: { id: req.user!.userId },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!candidate) {
      res.status(404).json({ success: false, error: 'Candidate not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        userType: 'candidate',
        candidate: {
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
          company: candidate.company,
        },
      },
    });
    return;
  }

  // Company user
  const user = await prisma.companyUser.findUnique({
    where: { id: req.user!.userId },
    include: { company: true },
  });

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      userType: 'company',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        plan: user.company.plan,
      },
    },
  });
});

export default router;
