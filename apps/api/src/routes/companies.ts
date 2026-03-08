import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticateCompany, authorize, type AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateCompany);


// ---- Validation ----

const createJobRoleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  skills: z.array(z.string()).default([]),
  level: z.enum(['junior', 'mid', 'senior', 'staff']).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  durationMin: z.number().int().min(5).max(120).default(30),
  config: z.object({
    topics: z.array(z.string()).default([]),
    questionCount: z.number().int().min(1).max(30).default(10),
    codingChallenges: z.number().int().min(0).max(5).default(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  }).default({}),
});

// ---- Job Roles ----

/**
 * POST /api/companies/roles
 */
router.post('/roles', async (req: AuthRequest, res: Response) => {
  try {
    const data = createJobRoleSchema.parse(req.body);
    const role = await prisma.jobRole.create({
      data: { ...data, companyId: req.user!.companyId },
    });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

/**
 * GET /api/companies/roles
 */
router.get('/roles', async (req: AuthRequest, res: Response) => {
  const roles = await prisma.jobRole.findMany({
    where: { companyId: req.user!.companyId },
    include: { _count: { select: { sessions: true, templates: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: roles });
});

/**
 * GET /api/companies/roles/:id
 */
router.get('/roles/:id', async (req: AuthRequest, res: Response) => {
  const roleId = req.params.id as string;
  const role = await prisma.jobRole.findFirst({
    where: { id: roleId, companyId: req.user!.companyId },
    include: { templates: true, _count: { select: { sessions: true } } },
  });
  if (!role) {
    res.status(404).json({ success: false, error: 'Job role not found' });
    return;
  }
  res.json({ success: true, data: role });
});

// ---- Interview Templates ----

/**
 * POST /api/companies/roles/:roleId/templates
 */
router.post('/roles/:roleId/templates', async (req: AuthRequest, res: Response) => {
  try {
    const roleId = req.params.roleId as string;
    const role = await prisma.jobRole.findFirst({
      where: { id: roleId, companyId: req.user!.companyId },
    });
    if (!role) {
      res.status(404).json({ success: false, error: 'Job role not found' });
      return;
    }

    const data = createTemplateSchema.parse(req.body);
    const template = await prisma.interviewTemplate.create({
      data: { ...data, jobRoleId: role.id },
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

/**
 * GET /api/companies/analytics
 * Dashboard analytics summary
 */
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  const companyId = req.user!.companyId;

  const [totalSessions, completedSessions, avgScore, roleCount] = await Promise.all([
    prisma.interviewSession.count({ where: { companyId } }),
    prisma.interviewSession.count({ where: { companyId, status: 'completed' } }),
    prisma.evaluation.aggregate({
      _avg: { overallScore: true },
      where: { session: { companyId } },
    }),
    prisma.jobRole.count({ where: { companyId } }),
  ]);

  res.json({
    success: true,
    data: {
      totalInterviews: totalSessions,
      completedInterviews: completedSessions,
      averageScore: avgScore._avg.overallScore ? Number(avgScore._avg.overallScore) : null,
      activeRoles: roleCount,
      completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
    },
  });
});

export default router;
