import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticateCompany, type AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

const router = Router();

router.use(authenticateCompany);

// ---- Validation ----

const addCandidateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  phone: z.string().optional(),
});

const bulkAddCandidatesSchema = z.object({
  candidates: z.array(addCandidateSchema).min(1).max(500),
});

// ---- Helpers ----

/**
 * Generate a unique login ID and password for a candidate.
 */
function generateCredentials(companySlug: string) {
  const loginId = `${companySlug}-${crypto.randomBytes(4).toString('hex')}`;
  const password = crypto.randomBytes(6).toString('base64url'); // 8 chars, URL-safe
  return { loginId, password };
}

// ---- Routes ----

/**
 * POST /api/candidates
 * Add a single candidate and generate login credentials
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = addCandidateSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Check if candidate already exists for this company
    const existing = await prisma.candidate.findFirst({
      where: { companyId, email: data.email },
    });
    if (existing) {
      res.status(409).json({ success: false, error: 'Candidate with this email already exists' });
      return;
    }

    // Get company slug for login ID prefix
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    const { loginId, password } = generateCredentials(company.slug);
    const passwordHash = await bcrypt.hash(password, 10);

    // Credentials expire in 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const candidate = await prisma.candidate.create({
      data: {
        companyId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        loginId,
        passwordHash,
        expiresAt,
      },
    });

    logger.info({ candidateId: candidate.id, companyId }, 'Candidate added');

    res.status(201).json({
      success: true,
      data: {
        candidate: {
          id: candidate.id,
          email: candidate.email,
          name: candidate.name,
        },
        credentials: {
          loginId,
          password, // Return plain-text only during creation
          expiresAt: candidate.expiresAt,
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
 * POST /api/candidates/bulk
 * Add multiple candidates at once
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { candidates: candidatesInput } = bulkAddCandidatesSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const results: Array<{
      email: string;
      name: string;
      loginId: string;
      password: string;
      status: 'created' | 'exists';
    }> = [];

    for (const c of candidatesInput) {
      const existing = await prisma.candidate.findFirst({
        where: { companyId, email: c.email },
      });

      if (existing) {
        results.push({ email: c.email, name: c.name, loginId: '', password: '', status: 'exists' });
        continue;
      }

      const { loginId, password } = generateCredentials(company.slug);
      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.candidate.create({
        data: {
          companyId,
          email: c.email,
          name: c.name,
          phone: c.phone,
          loginId,
          passwordHash,
          expiresAt,
        },
      });

      results.push({ email: c.email, name: c.name, loginId, password, status: 'created' });
    }

    const created = results.filter(r => r.status === 'created').length;
    logger.info({ companyId, total: candidatesInput.length, created }, 'Bulk candidates added');

    res.status(201).json({
      success: true,
      data: {
        total: candidatesInput.length,
        created,
        skipped: candidatesInput.length - created,
        candidates: results,
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
 * GET /api/candidates
 * List all candidates for the company
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const companyId = req.user!.companyId;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
  const search = req.query.search as string | undefined;

  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        loginId: true,
        expiresAt: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.candidate.count({ where }),
  ]);

  res.json({
    success: true,
    data: candidates,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

/**
 * GET /api/candidates/:id
 * Get a single candidate with their interview sessions
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const candidateId = req.params.id as string;
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId: req.user!.companyId },
    include: {
      sessions: {
        include: {
          jobRole: { select: { title: true } },
          evaluation: { select: { overallScore: true, recommendation: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  res.json({ success: true, data: candidate });
});

/**
 * DELETE /api/candidates/:id
 * Remove a candidate
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const candidateId = req.params.id as string;
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId: req.user!.companyId },
  });

  if (!candidate) {
    res.status(404).json({ success: false, error: 'Candidate not found' });
    return;
  }

  await prisma.candidate.delete({ where: { id: candidate.id } });
  logger.info({ candidateId: candidate.id }, 'Candidate deleted');

  res.json({ success: true, message: 'Candidate deleted' });
});

export default router;
