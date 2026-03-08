import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticateCompany, authenticateCandidate, authenticate, authorize, type AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

const router = Router();

// ---- Validation Schemas ----

const createSessionSchema = z.object({
  candidateEmail: z.string().email(),
  candidateName: z.string().min(1).optional(),
  jobRoleId: z.string().uuid(),
  templateId: z.string().uuid(),
});

// ---- Company Routes (require company auth) ----

/**
 * POST /api/interviews
 * Create a new interview session and generate an invite token
 */
router.post('/', authenticateCompany, async (req: AuthRequest, res: Response) => {
  try {
    const { candidateEmail, candidateName, jobRoleId, templateId } = createSessionSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Verify job role belongs to this company
    const jobRole = await prisma.jobRole.findFirst({
      where: { id: jobRoleId, companyId },
    });
    if (!jobRole) {
      res.status(404).json({ success: false, error: 'Job role not found' });
      return;
    }

    // Find or create candidate (scoped to company)
    let candidate = await prisma.candidate.findFirst({
      where: { companyId, email: candidateEmail },
    });
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          companyId,
          email: candidateEmail,
          name: candidateName,
        },
      });
    }

    // Create interview session with unique invite token
    const inviteToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);

    const session = await prisma.interviewSession.create({
      data: {
        candidateId: candidate.id,
        jobRoleId,
        templateId,
        companyId,
        inviteToken,
        status: 'pending',
      },
      include: {
        candidate: true,
        jobRole: true,
        template: true,
      },
    });

    logger.info({ sessionId: session.id, companyId }, 'Interview session created');

    res.status(201).json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          inviteToken: session.inviteToken,
          inviteUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/interview/${session.inviteToken}`,
          candidate: { id: session.candidate.id, email: session.candidate.email, name: session.candidate.name },
          jobRole: { id: session.jobRole.id, title: session.jobRole.title },
          template: { id: session.template.id, name: session.template.name, durationMin: session.template.durationMin },
          createdAt: session.createdAt,
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
 * GET /api/interviews
 * List interview sessions for the company
 */
router.get('/', authenticateCompany, async (req: AuthRequest, res: Response) => {
  const companyId = req.user!.companyId;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
  const status = req.query.status as string | undefined;

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;

  const [sessions, total] = await Promise.all([
    prisma.interviewSession.findMany({
      where,
      include: {
        candidate: { select: { id: true, email: true, name: true } },
        jobRole: { select: { id: true, title: true } },
        evaluation: { select: { overallScore: true, recommendation: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.interviewSession.count({ where }),
  ]);

  res.json({
    success: true,
    data: sessions,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

/**
 * GET /api/interviews/:id
 * Get full interview session details with responses and evaluation
 */
router.get('/:id', authenticateCompany, async (req: AuthRequest, res: Response) => {
  const sessionId = req.params.id as string;
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: req.user!.companyId },
    include: {
      candidate: true,
      jobRole: true,
      template: true,
      responses: { orderBy: { sequenceNum: 'asc' } },
      codeSubmissions: true,
      evaluation: true,
    },
  });

  if (!session) {
    res.status(404).json({ success: false, error: 'Interview session not found' });
    return;
  }

  res.json({ success: true, data: session });
});

// ---- Public Route (no auth — candidate joins via token) ----

/**
 * GET /api/interviews/join/:token
 * Candidate joins an interview via invite token (no auth required)
 */
router.get('/join/:token', async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const session = await prisma.interviewSession.findUnique({
    where: { inviteToken: token },
    include: {
      jobRole: { select: { title: true, skills: true, level: true } },
      template: { select: { name: true, durationMin: true, config: true } },
      company: { select: { name: true, logoUrl: true } },
    },
  });

  if (!session) {
    res.status(404).json({ success: false, error: 'Invalid or expired invite link' });
    return;
  }

  if (session.status === 'completed' || session.status === 'expired') {
    res.status(410).json({ success: false, error: 'This interview has already been completed or expired' });
    return;
  }

  res.json({
    success: true,
    data: {
      sessionId: session.id,
      company: session.company,
      jobRole: session.jobRole,
      template: session.template,
      status: session.status,
    },
  });
});

// ---- Candidate Route ----

/**
 * GET /api/interviews/my
 * Get interviews assigned to the logged-in candidate
 */
router.get('/my/sessions', authenticateCandidate, async (req: AuthRequest, res: Response) => {
  const candidateId = req.user!.userId;

  const sessions = await prisma.interviewSession.findMany({
    where: { candidateId },
    include: {
      jobRole: { select: { title: true, skills: true, level: true } },
      template: { select: { name: true, durationMin: true } },
      company: { select: { name: true, logoUrl: true } },
      evaluation: { select: { overallScore: true, recommendation: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: sessions });
});

export default router;
