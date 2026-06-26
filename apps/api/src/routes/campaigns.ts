import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticateCompany, type AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { sendAssessmentEmail } from '../lib/email';

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

const createMultiStepCampaignSchema = z.object({
  roleTitle: z.string().min(1).max(255),
  jobDescription: z.string().min(1),
  testType: z.enum(['coding', 'video']),
  durationMin: z.number().int().min(10).max(120),
  expiresAt: z.string().optional().nullable(),
  
  // Coding Assessment configs (legacy/coming soon)
  allowedLanguages: z.array(z.string()).optional(),
  selectedQuestions: z.array(z.string().uuid()).optional(),
  
  // AI Video Interview configs
  tone: z.enum(['strict', 'friendly', 'professional']).optional(),
  thinkTime: z.number().int().optional(),
  retakeLimit: z.number().int().optional(),
  
  // Groq configs
  groqApiKey: z.string().optional().nullable(),
  saveAsGlobalDefault: z.boolean().optional().nullable(),
});

const inviteCandidatesSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(200),
});

// ---- Routes ----

/**
 * POST /api/campaigns
 * Create a new interview campaign (supports legacy format and new multi-step wizard format)
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  const companyId = req.user!.companyId;

  // 1. Detect if it is the new Multi-step wizard format (has roleTitle)
  if (req.body.roleTitle) {
    try {
      const data = createMultiStepCampaignSchema.parse(req.body);

      // Save Groq API key globally if requested
      if (data.groqApiKey && data.saveAsGlobalDefault) {
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        const existingSettings = company?.settings && typeof company.settings === 'object' ? company.settings : {};
        await prisma.company.update({
          where: { id: companyId },
          data: {
            settings: {
              ...existingSettings,
              groqApiKey: data.groqApiKey,
            },
          },
        });
      }

      // Find or create Job Role for company
      let jobRole = await prisma.jobRole.findFirst({
        where: { title: data.roleTitle, companyId },
      });

      if (!jobRole) {
        jobRole = await prisma.jobRole.create({
          data: {
            companyId,
            title: data.roleTitle,
            description: data.jobDescription,
            skills: [],
            level: 'junior',
          },
        });
      } else {
        jobRole = await prisma.jobRole.update({
          where: { id: jobRole.id },
          data: { description: data.jobDescription },
        });
      }

      // Create Interview Template
      const templateConfig = {
        testType: data.testType,
        tone: data.tone || 'professional',
        thinkTime: data.thinkTime || 30,
        retakeLimit: data.retakeLimit || 0,
      };

      const template = await prisma.interviewTemplate.create({
        data: {
          jobRoleId: jobRole.id,
          name: `${data.roleTitle} AI Video Interview`,
          durationMin: data.durationMin,
          config: templateConfig as any,
        },
      });

      // Create Campaign
      const campaign = await prisma.campaign.create({
        data: {
          companyId,
          title: `${data.roleTitle} Campaign`,
          description: data.jobDescription,
          jobRoleId: jobRole.id,
          templateId: template.id,
          durationMin: data.durationMin,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        },
      });

      logger.info({ campaignId: campaign.id, companyId }, 'Campaign created');

      res.status(201).json({
        success: true,
        data: {
          campaign: {
            id: campaign.id,
            title: campaign.title,
            status: campaign.status,
            createdAt: campaign.createdAt,
            jobRole: { title: jobRole.title },
            template: { name: template.name, durationMin: template.durationMin },
            _count: { sessions: 0 },
          },
          invites: [],
        },
      });
      return;
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(422).json({ success: false, error: 'Validation failed', details: err.errors });
        return;
      }
      logger.error({ err }, 'Error in multi-step campaign creation route');
      throw err;
    }
  }

  // 2. Legacy schema handler
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
 * GET /api/campaigns/questions/pool
 * Get all available coding questions for selection
 */
router.get('/questions/pool', async (req: AuthRequest, res: Response) => {
  try {
    const questions = await prisma.question.findMany({
      where: {
        OR: [
          { companyId: req.user!.companyId },
          { companyId: null } // Global seeded questions
        ],
        type: 'coding'
      },
      select: {
        id: true,
        difficulty: true,
        topic: true,
        content: true,
      }
    });

    // Parse the title / description from the question content (usually first line or heading)
    const formatted = questions.map(q => {
      const firstLine = q.content.split('\n')[0] || '';
      const title = firstLine.replace(/^(#+\s*|\*\*\s*)/, '').replace(/\*\*$/, '').trim();
      return {
        id: q.id,
        title: title || `${q.topic} Challenge`,
        difficulty: q.difficulty || 'medium',
        topic: q.topic || 'Coding',
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    logger.error({ err }, 'Error fetching question pool');
    res.status(500).json({ success: false, error: 'Failed to fetch question pool' });
  }
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

  const sessions = campaign.sessions;
  const invitedCount = sessions.length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const completedScores = sessions
    .filter(s => s.status === 'completed' && s.evaluation)
    .map(s => Number(s.evaluation!.overallScore));
  const avgScore = completedScores.length > 0 
    ? Math.round(completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length)
    : 0;

  res.json({
    success: true,
    data: {
      ...campaign,
      metrics: {
        invited: invitedCount,
        completed: completedCount,
        avgScore,
      }
    }
  });
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

// ---- Helpers ----
function generateCredentials(companySlug: string) {
  const loginId = `${companySlug}-${crypto.randomBytes(4).toString('hex')}`;
  const password = crypto.randomBytes(6).toString('base64url'); // 8 chars, URL-safe
  return { loginId, password };
}

const bulkCandidateItemSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  phone: z.string().optional().nullable(),
  resume: z.string().optional().nullable(),
});

const bulkCampaignCandidatesSchema = z.object({
  candidates: z.array(bulkCandidateItemSchema).min(1).max(500),
});

/**
 * POST /api/campaigns/:campaignId/candidates/bulk
 * Upload candidate list specifically for this campaign and invite them
 */
router.post('/:campaignId/candidates/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;
    const { candidates: candidatesInput } = bulkCampaignCandidatesSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Verify campaign exists and belongs to this company
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, companyId },
    });

    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

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
      status: 'created' | 'exists';
      inviteUrl?: string;
    }> = [];

    for (const c of candidatesInput) {
      const existing = await prisma.candidate.findFirst({
        where: { campaignId, email: c.email },
      });

      let session;
      let status: 'created' | 'exists';
      let loginId = '';
      let plaintextPassword = '';

      if (existing) {
        status = 'exists';
        loginId = existing.loginId || '';
        // Find or create interview session
        session = await prisma.interviewSession.findFirst({
          where: { campaignId, candidateId: existing.id },
        });

        if (!session) {
          const inviteToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);
          session = await prisma.interviewSession.create({
            data: {
              candidateId: existing.id,
              jobRoleId: campaign.jobRoleId,
              templateId: campaign.templateId,
              companyId,
              campaignId: campaign.id,
              inviteToken,
              status: 'pending',
            },
          });
        }
      } else {
        status = 'created';
        const credentials = generateCredentials(company.slug);
        loginId = credentials.loginId;
        plaintextPassword = credentials.password;
        const passwordHash = await bcrypt.hash(credentials.password, 10);

        // Create candidate
        const candidate = await prisma.candidate.create({
          data: {
            companyId,
            campaignId,
            email: c.email,
            name: c.name,
            phone: c.phone || null,
            loginId,
            passwordHash,
            expiresAt,
            resumeUrl: c.resume?.startsWith('http') ? c.resume : null,
            metadata: c.resume ? { resumeText: c.resume } : {},
          },
        });

        // Create interview session
        const inviteToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);
        session = await prisma.interviewSession.create({
          data: {
            candidateId: candidate.id,
            jobRoleId: campaign.jobRoleId,
            templateId: campaign.templateId,
            companyId,
            campaignId: campaign.id,
            inviteToken,
            status: 'pending',
          },
        });
      }

      // Trigger the automated assessment invitation email immediately
      const testLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/interview/${session.inviteToken}/setup`;
      const expiryFormatted = campaign.expiresAt 
        ? new Date(campaign.expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' }) 
        : '30 days from now';

      // Log credentials to API logs for easy copy-paste testing access
      if (status === 'created') {
        logger.info({ email: c.email, loginId, password: plaintextPassword }, 'Candidate credentials generated for testing');
      }

      await sendAssessmentEmail(
        c.email,
        c.name,
        campaign.title,
        testLink,
        expiryFormatted,
        campaign.durationMin,
        loginId,
        plaintextPassword
      );

      results.push({
        email: c.email,
        name: c.name,
        loginId,
        status,
        inviteUrl: testLink,
      });
    }

    const created = results.filter(r => r.status === 'created').length;
    logger.info({ companyId, campaignId, total: candidatesInput.length, created }, 'Bulk campaign candidates added');

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
    logger.error({ err }, 'Error in bulk campaign candidates upload');
    res.status(500).json({ success: false, error: 'Failed to upload candidates' });
  }
});

/**
 * GET /api/campaigns/:campaignId/candidates/:candidateId/evaluation
 * Fetch detailed candidate evaluation report and full Q&A transcript
 */
router.get('/:campaignId/candidates/:candidateId/evaluation', async (req: AuthRequest, res: Response) => {
  try {
    const campaignId = req.params.campaignId as string;
    const candidateId = req.params.candidateId as string;
    const companyId = req.user!.companyId;

    // Verify candidate belongs to campaign and company
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, campaignId, companyId },
    });

    if (!candidate) {
      res.status(404).json({ success: false, error: 'Candidate not found in this campaign' });
      return;
    }

    // Find the session with evaluation & responses
    const session = await prisma.interviewSession.findFirst({
      where: { campaignId, candidateId, companyId },
      include: {
        evaluation: true,
        responses: {
          orderBy: { sequenceNum: 'asc' },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Interview session not found for this candidate' });
      return;
    }

    res.json({
      success: true,
      data: {
        candidate,
        session,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error fetching candidate evaluation');
    res.status(500).json({ success: false, error: 'Failed to fetch candidate evaluation' });
  }
});

export default router;
