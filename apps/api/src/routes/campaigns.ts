import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import { authenticateCompany, type AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

const router = Router();

router.use(authenticateCompany);

// ---- Validation ----

const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  jobRoleId: z.string().uuid(),
  templateId: z.string().uuid(),
  durationMin: z.number().int().min(10).max(120).default(45),
  expiresAt: z.string().datetime().optional(),
});

const inviteCandidatesSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(200),
});

// ---- Routes ----

/**
 * POST /api/campaigns
 * Create a new interview campaign
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = createCampaignSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Verify job role and template belong to this company
    const [jobRole, template] = await Promise.all([
      prisma.jobRole.findFirst({ where: { id: data.jobRoleId, companyId } }),
      prisma.interviewTemplate.findFirst({
        where: { id: data.templateId, jobRole: { companyId } },
      }),
    ]);

    if (!jobRole) {
      res.status(404).json({ success: false, error: 'Job role not found' });
      return;
    }
    if (!template) {
      res.status(404).json({ success: false, error: 'Interview template not found' });
      return;
    }

    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        title: data.title,
        description: data.description,
        jobRoleId: data.jobRoleId,
        templateId: data.templateId,
        durationMin: data.durationMin,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
      include: {
        jobRole: { select: { title: true } },
        template: { select: { name: true } },
      },
    });

    logger.info({ campaignId: campaign.id, companyId }, 'Campaign created');

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
      return;
    }
    throw err;
  }
});

/**
 * GET /api/campaigns
 * List all campaigns for the company
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  const companyId = req.user!.companyId;

  const campaigns = await prisma.campaign.findMany({
    where: { companyId },
    include: {
      jobRole: { select: { title: true } },
      template: { select: { name: true, durationMin: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: campaigns });
});

/**
 * GET /api/campaigns/:id
 * Get campaign details with sessions
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const campaignId = req.params.id as string;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, companyId: req.user!.companyId },
    include: {
      jobRole: true,
      template: true,
      sessions: {
        include: {
          candidate: { select: { id: true, email: true, name: true } },
          evaluation: { select: { overallScore: true, recommendation: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  res.json({ success: true, data: campaign });
});

/**
 * POST /api/campaigns/:id/invite
 * Add candidates to a campaign — creates interview sessions with invite tokens
 */
router.post('/:id/invite', async (req: AuthRequest, res: Response) => {
  try {
    const { candidateIds } = inviteCandidatesSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const campaignId = req.params.id as string;
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    if (campaign.status !== 'active') {
      res.status(400).json({ success: false, error: 'Campaign is not active' });
      return;
    }

    // Verify all candidates belong to this company
    const candidates = await prisma.candidate.findMany({
      where: { id: { in: candidateIds }, companyId },
    });

    if (candidates.length !== candidateIds.length) {
      res.status(400).json({ success: false, error: 'Some candidates not found or do not belong to this company' });
      return;
    }

    // Check for already-invited candidates
    const existingSessions = await prisma.interviewSession.findMany({
      where: {
        campaignId: campaign.id,
        candidateId: { in: candidateIds },
      },
      select: { candidateId: true },
    });

    const alreadyInvited = new Set(existingSessions.map((s: { candidateId: string }) => s.candidateId));
    const newCandidateIds = candidateIds.filter(id => !alreadyInvited.has(id));

    if (newCandidateIds.length === 0) {
      res.status(400).json({ success: false, error: 'All candidates are already invited to this campaign' });
      return;
    }

    // Create interview sessions
    const sessions = await prisma.$transaction(
      newCandidateIds.map(candidateId =>
        prisma.interviewSession.create({
          data: {
            candidateId,
            jobRoleId: campaign.jobRoleId,
            templateId: campaign.templateId,
            companyId,
            campaignId: campaign.id,
            inviteToken: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32),
            status: 'pending',
          },
          include: {
            candidate: { select: { id: true, email: true, name: true } },
          },
        })
      )
    );

    logger.info({
      campaignId: campaign.id,
      invitedCount: sessions.length,
      skippedCount: alreadyInvited.size,
    }, 'Candidates invited to campaign');

    res.status(201).json({
      success: true,
      data: {
        invited: sessions.length,
        skipped: alreadyInvited.size,
        sessions: sessions.map((s: { id: string; inviteToken: string; candidate: { email: string; name: string | null } }) => ({
          id: s.id,
          candidateEmail: s.candidate.email,
          candidateName: s.candidate.name,
          inviteToken: s.inviteToken,
          inviteUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/interview/${s.inviteToken}`,
        })),
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
 * PATCH /api/campaigns/:id
 * Update campaign status
 */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const campaignId = req.params.id as string;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, companyId: req.user!.companyId },
  });

  if (!campaign) {
    res.status(404).json({ success: false, error: 'Campaign not found' });
    return;
  }

  const { status } = z.object({ status: z.enum(['active', 'paused', 'archived']) }).parse(req.body);

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status },
  });

  res.json({ success: true, data: updated });
});

export default router;
