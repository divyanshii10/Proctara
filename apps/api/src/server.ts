// ============================================
// Proctara Express Server
// Main entry point for the API
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import authRoutes from './routes/auth';
import companyRoutes from './routes/companies';
import interviewRoutes from './routes/interviews';
import candidateRoutes from './routes/candidates';
import campaignRoutes from './routes/campaigns';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './lib/logger';
import prisma from './lib/prisma';
import { generateInitialQuestion, generateFollowUpQuestion, evaluateSessionAndSave } from './services/interviewBot';
import { transcribeAudioBuffer } from './services/groqClient';
import { evaluateAnswer } from './services/aiEvaluation';

// ---- App Setup ----

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.API_PORT || '3001', 10);

// Socket.io for real-time interview communication
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

// ---- Middleware ----

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('short'));

// ---- Health Check ----

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'proctara-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---- API Routes ----

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/campaigns', campaignRoutes);

// ---- WebSocket Handlers ----

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('interview:reset', async (data: { sessionId: string }) => {
    logger.info({ sessionId: data.sessionId }, 'Explicit session reset requested');
    try {
      await prisma.response.deleteMany({
        where: { sessionId: data.sessionId },
      });
      await prisma.interviewSession.update({
        where: { id: data.sessionId },
        data: { status: 'pending' }
      });
    } catch (err) {
      logger.error({ err, sessionId: data.sessionId }, 'Failed to reset session');
    }
  });

  socket.on('interview:start', async (data: { sessionId: string; reset?: boolean; transcript?: string }) => {
    let { sessionId, reset, transcript } = data;
    socket.join(`interview:${sessionId}`);
    logger.info({ sessionId, socketId: socket.id, reset }, 'Candidate joined interview room');

    try {
      // Find session first to check if we need a test override reset
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          candidate: true,
          campaign: true,
          company: true,
          jobRole: true,
          template: true,
          responses: { orderBy: { sequenceNum: 'asc' } },
        },
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // STRICT CHECK: Block re-attempts
      if (session.status === 'completed' || session.status === 'expired') {
        socket.emit('error', { message: 'This interview session has already been completed or expired.' });
        return;
      }

      if (reset) {
        logger.info({ sessionId }, 'Resetting responses for a fresh interview start');
        await prisma.response.deleteMany({
          where: { sessionId },
        });
      }

      // Update status if pending or reset
      if (session.status === 'pending' || reset) {
        const meta = (session.metadata as any) || {};
        meta.violations = [];

        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { status: 'in_progress', startedAt: new Date(), metadata: meta },
        });
        session.status = 'in_progress';
      }

      // If we are resetting, clear the local responses array
      if (reset) {
        session.responses = [];
      }

      // If we already have responses, find the active unanswered one
      if (session.responses.length > 0) {
        const unansweredResp = session.responses.find(r => !r.answerText);
        if (unansweredResp) {
          let spokenText = unansweredResp.questionText;
          let phase = 'INTERVIEW';
          try {
            const parsed = JSON.parse(unansweredResp.questionText);
            if (parsed.speechOutput) {
              spokenText = parsed.speechOutput;
              phase = parsed.currentPhase || 'INTERVIEW';
            }
          } catch (e) {}

          socket.emit('interview:question', {
            questionText: spokenText,
            currentPhase: phase,
            type: 'behavioral',
            sequenceNum: unansweredResp.sequenceNum,
          });
          return;
        }

        // Dynamic Duration & Question Check
        // If the elapsed time exceeds durationMin, or we hit a maximum failsafe (e.g., 20 questions), end the interview.
        const elapsedMinutes = session.startedAt ? (Date.now() - new Date(session.startedAt).getTime()) / 60000 : 0;
        const durationLimit = session.template?.durationMin || 45;
        const maxQuestionsFailsafe = 25; // Hard cap so it doesn't go on infinitely

        if (session.responses.length < maxQuestionsFailsafe && elapsedMinutes < durationLimit) {
          const jd = session.campaign?.description || 'Software Engineer position';
          const resume = (session.candidate.metadata as any)?.resumeText || 'No resume available';
          const companySettings = session.company.settings as any;
          const groqApiKey = companySettings?.groqApiKey;

          const history = session.responses.map(r => ({
            questionText: r.questionText,
            answerText: r.answerText || '',
          }));

          const nextSequenceNum = session.responses.length + 1;
          logger.info({ sessionId, nextSequenceNum }, 'Generating follow-up question on reconnect');
          const nextQuestion = await generateFollowUpQuestion(jd, resume, session.jobRole.title, 'professional', history, groqApiKey);

          await prisma.response.create({
            data: {
              sessionId,
              questionText: nextQuestion,
              sequenceNum: nextSequenceNum,
            },
          });

          let spokenText = nextQuestion;
          let phase = 'INTERVIEW';
          try {
            const parsed = JSON.parse(nextQuestion);
            if (parsed.speechOutput) {
              spokenText = parsed.speechOutput;
              phase = parsed.currentPhase || 'INTERVIEW';
            }
          } catch (e) {}

          socket.emit('interview:question', {
            questionText: spokenText,
            currentPhase: phase,
            type: 'behavioral',
            sequenceNum: nextSequenceNum,
          });
          return;
        } else {
          // Already completed
          socket.emit('interview:feedback', {
            received: true,
            message: 'Thank you! Your interview has been successfully completed.',
            completed: true,
          });
          return;
        }
      }

      // Otherwise, generate the first question (Intro Onboarding rules Jordan Phase 1)
      const jd = session.campaign?.description || 'Software Engineer position';
      const resume = (session.candidate.metadata as any)?.resumeText || 'No resume available';
      const companySettings = session.company.settings as any;
      const groqApiKey = companySettings?.groqApiKey;

      logger.info({ sessionId }, 'Generating Phase 2 launch from resume and JD');

      const firstQuestion = await generateInitialQuestion(jd, resume, session.jobRole.title, 'professional', groqApiKey, transcript || 'yes');

      // Save question to DB
      await prisma.response.create({
        data: {
          sessionId,
          questionText: firstQuestion,
          sequenceNum: 1,
        },
      });

      let spokenText = firstQuestion;
      let phase = 'LAUNCH';
      try {
        const parsed = JSON.parse(firstQuestion);
        if (parsed.speechOutput) {
          spokenText = parsed.speechOutput;
          phase = parsed.currentPhase || 'LAUNCH';
        }
      } catch (e) {}

      socket.emit('interview:question', {
        questionText: spokenText,
        currentPhase: phase,
        type: 'behavioral',
        sequenceNum: 1,
      });

    } catch (err) {
      logger.error({ err, sessionId }, 'Error starting interview WebSocket session');
      socket.emit('error', { message: 'Failed to start interview session' });
    }
  });

  async function processAnswer(sessionId: string, answerText: string, socket: any) {
    logger.info({ sessionId, answerLength: answerText.length }, 'Answer received');

    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          candidate: true,
          campaign: true,
          company: true,
          jobRole: true,
          template: true,
          responses: { orderBy: { sequenceNum: 'asc' } },
        },
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Find the last response that has no answer
      const activeResponse = session.responses.find(r => !r.answerText);
      if (!activeResponse) {
        if (session.responses.length === 0) {
          logger.info({ sessionId }, 'No active response found. Treating candidate response as the launch handshake.');
          
          const jd = session.campaign?.description || 'Software Engineer position';
          const resume = (session.candidate.metadata as any)?.resumeText || 'No resume available';
          const companySettings = session.company.settings as any;
          const groqApiKey = companySettings?.groqApiKey;

          socket.emit('interview:feedback', { received: true, message: 'Audio processed. Launching interview...' });

          const firstQuestion = await generateInitialQuestion(jd, resume, session.jobRole.title, 'professional', groqApiKey, answerText);

          // Re-check session status to prevent generating question if user quit while waiting
          const currentSession = await prisma.interviewSession.findUnique({ where: { id: sessionId }, select: { status: true } });
          if (currentSession?.status === 'completed') return;

          await prisma.response.create({
            data: {
              sessionId,
              questionText: firstQuestion,
              sequenceNum: 1,
            },
          });

          let spokenText = firstQuestion;
          let phase = 'LAUNCH';
          try {
            const parsed = JSON.parse(firstQuestion);
            if (parsed.speechOutput) {
              spokenText = parsed.speechOutput;
              phase = parsed.currentPhase || 'LAUNCH';
            }
          } catch (e) {}

          socket.emit('interview:question', {
            questionText: spokenText,
            currentPhase: phase,
            type: 'behavioral',
            sequenceNum: 1,
          });
          return;
        }

        socket.emit('error', { message: 'No active question found to answer' });
        return;
      }

      // Update response with answer
      await prisma.response.update({
        where: { id: activeResponse.id },
        data: { answerText },
      });

      const nextSequenceNum = activeResponse.sequenceNum + 1;
      const totalQuestions = 6; // Onboarding intro + 5 technical questions
      const jd = session.campaign?.description || 'Software Engineer position';
      const companySettings = session.company.settings as any;
      const groqApiKey = companySettings?.groqApiKey;

      // Strict DB-level check to ensure we haven't quit concurrently during audio processing
      const currentSessionStatus = await prisma.interviewSession.findUnique({ where: { id: sessionId }, select: { status: true }});
      if (currentSessionStatus?.status === 'completed' || session.status === 'completed') {
        logger.info({ sessionId }, 'Session already completed (e.g., via manual quit). Bypassing follow-up generation.');
        return;
      }

      const elapsedMinutes = session.startedAt ? (Date.now() - new Date(session.startedAt).getTime()) / 60000 : 0;
      const durationLimit = session.template?.durationMin || 45;
      const maxQuestionsFailsafe = 25;

      if (activeResponse.sequenceNum >= maxQuestionsFailsafe || elapsedMinutes >= durationLimit) {
        // End interview session
        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { status: 'completed', completedAt: new Date() },
        });

        socket.emit('interview:complete', {
          message: 'Interview Complete. Generating your final report...',
        });

        // Background final evaluation
        try {
          await evaluateSessionAndSave(sessionId, groqApiKey);
          logger.info({ sessionId }, 'Interview evaluation complete');
          socket.emit('interview:report_saved', { success: true });
        } catch (err) {
          logger.error({ err, sessionId }, 'Failed to evaluate interview');
          socket.emit('interview:report_saved', { success: false });
        }
      } else {
        // Fast Loop: Generate next question
        const resume = (session.candidate.metadata as any)?.resumeText || 'No resume available';

        if (session.responses.length === 1 && answerText === "[USER TIMEOUT / SILENT]") {
          logger.info({ sessionId }, 'Failsafe: Caught handshake timeout, bypassing Groq');
          await prisma.response.update({
            where: { id: activeResponse.id },
            data: { answerText: null },
          });

          socket.emit('interview:question', {
            questionText: "Take your time. Just say 'yes' or 'ready' whenever you are set to begin.",
            currentPhase: 'HANDSHAKE',
            type: 'behavioral',
            sequenceNum: 1,
          });
          return;
        }

        const history = session.responses.map(r => ({
          questionText: r.questionText,
          answerText: r.id === activeResponse.id ? answerText : (r.answerText || ''),
        }));

        logger.info({ sessionId, nextSequenceNum }, 'Generating follow-up question');
        const nextQuestionPromise = generateFollowUpQuestion(jd, resume, session.jobRole.title, 'professional', history, groqApiKey);

        // Background Loop: Score the previous answer asynchronously
        if (activeResponse.sequenceNum > 1 && answerText.trim() !== '' && answerText !== "[System: Timeout - Candidate remained silent]") {
          let cleanQuestionText = activeResponse.questionText;
          try {
            const parsed = JSON.parse(cleanQuestionText);
            cleanQuestionText = parsed.speechOutput || cleanQuestionText;
          } catch (e) {}

          evaluateAnswer({
            roleTitle: session.jobRole.title,
            companyName: session.company.name,
            seniorityLevel: 'mid',
            questionTopic: 'technical',
            questionText: cleanQuestionText,
            rubricCriteria: 'Evaluate accuracy and problem solving.',
            answerText: answerText
          }).then(async (evalResult) => {
            await prisma.response.update({
              where: { id: activeResponse.id },
              data: {
                aiScore: evalResult.overallScore,
                aiFeedback: evalResult as any
              }
            });
            logger.info({ sessionId, sequenceNum: activeResponse.sequenceNum, score: evalResult.overallScore }, 'Background answer scoring complete');
          }).catch(err => logger.error({ err, sessionId }, 'Background scoring failed'));
        }

        let nextQuestion = '';
        try {
          logger.info({ sessionId }, 'Awaiting follow-up question from Groq...');
          nextQuestion = await nextQuestionPromise;
          logger.info({ sessionId, nextQuestionLength: nextQuestion.length }, 'Follow-up question generated successfully');
        } catch (groqErr) {
          logger.error({ err: groqErr, sessionId }, 'Groq failed to generate follow-up question');
          throw groqErr;
        }

        // Save new question to DB
        await prisma.response.create({
          data: {
            sessionId,
            questionText: nextQuestion,
            sequenceNum: nextSequenceNum,
          },
        });

        let spokenText = nextQuestion;
        let phase = 'INTERVIEW';
        try {
          const parsed = JSON.parse(nextQuestion);
          if (parsed.speechOutput) {
            spokenText = parsed.speechOutput;
            phase = parsed.currentPhase || 'INTERVIEW';
          }
        } catch (e) {}

        socket.emit('interview:feedback', {
          received: true,
          message: 'Answer recorded. Generating next question...',
        });

        socket.emit('interview:question', {
          questionText: spokenText,
          currentPhase: phase,
          type: 'behavioral',
          sequenceNum: nextSequenceNum,
        });
      }
    } catch (err) {
      logger.error({ err, sessionId }, 'Error handling candidate answer');
      socket.emit('error', { message: 'Failed to process your response' });
    }
  }

  socket.on('interview:answer', async (data: { sessionId: string; answerText: string }) => {
    await processAnswer(data.sessionId, data.answerText, socket);
  });

  socket.on('interview:audio_answer', async (data: { sessionId: string; audioBuffer: Buffer }) => {
    const { sessionId, audioBuffer } = data;
    logger.info({ sessionId, bytes: audioBuffer?.length || 0 }, 'Audio answer received');

    try {
      if (!audioBuffer || audioBuffer.length === 0) {
        socket.emit('error', { message: 'No audio detected. Please try speaking again.' });
        return;
      }
      
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: { company: true }
      });
      
      const groqApiKey = (session?.company?.settings as any)?.groqApiKey;

      socket.emit('interview:feedback', { received: true, message: 'Transcribing your audio...' });

      // In-Memory Streaming to Whisper
      let answerText = await transcribeAudioBuffer(audioBuffer, groqApiKey);
      answerText = answerText ? answerText.trim() : '';
      
      // Filter out common Whisper hallucinations for silence/noise
      const hallucinations = ["Thank you.", "Thank you", ".", "Thanks for watching.", "Subtitles by Amara.org", "I'm going to go to the next one."];
      if (!answerText || answerText.length < 2 || hallucinations.includes(answerText)) {
        logger.info({ sessionId }, 'Candidate was silent or audio was just noise');
        answerText = '[System: Timeout - Candidate remained silent]';
      } else {
        // Send the transcribed text back to the frontend for debugging (only if they actually spoke)
        socket.emit('interview:feedback', { received: true, message: `You said: "${answerText}"` });
      }

      await processAnswer(sessionId, answerText, socket);
    } catch (err) {
      logger.error({ err, sessionId }, 'Error processing audio answer');
      socket.emit('error', { message: 'Failed to transcribe audio. Please try speaking again.' });
      // We intentionally DO NOT call processAnswer here. The client will reset to IDLE_WAIT and let the user try again.
    }
  });

  socket.on('interview:code_submit', async (data: { sessionId: string; code: string; language: string }) => {
    logger.info({ sessionId: data.sessionId, language: data.language }, 'Code submission received');
    socket.emit('interview:code_result', {
      status: 'processing',
      message: 'Running your code against test cases...',
    });
  });

  socket.on('interview:violation', async (data: { sessionId: string; type: string }) => {
    logger.warn({ sessionId: data.sessionId, type: data.type }, 'Proctoring violation detected');
    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: data.sessionId },
        select: { metadata: true }
      });
      if (!session) return;
      
      const meta = (session.metadata as any) || {};
      if (!meta.violations) meta.violations = [];
      
      meta.violations.push({
        type: data.type,
        timestamp: new Date().toISOString()
      });
      
      await prisma.interviewSession.update({
        where: { id: data.sessionId },
        data: { metadata: meta }
      });
    } catch (err) {
      logger.error({ err, sessionId: data.sessionId }, 'Failed to record violation');
    }
  });

  socket.on('interview:end', async (data: { sessionId: string }) => {
    logger.info({ sessionId: data.sessionId }, 'Candidate manually ended interview');
    
    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: data.sessionId },
        include: { company: true }
      });
      if (!session) return;

      const groqApiKey = (session.company.settings as any)?.groqApiKey;

      await prisma.interviewSession.update({
        where: { id: data.sessionId },
        data: { status: 'completed', completedAt: new Date() },
      });

      socket.emit('interview:complete', {
        message: 'Interview Complete. Generating your final report...',
      });

      // Background final evaluation
      evaluateSessionAndSave(data.sessionId, groqApiKey).then(() => {
        logger.info({ sessionId: data.sessionId }, 'Manual end interview evaluation complete');
        socket.emit('interview:report_saved', { success: true });
      }).catch(err => {
        logger.error({ err, sessionId: data.sessionId }, 'Failed to evaluate interview after manual end');
        socket.emit('interview:report_saved', { success: false });
      });
    } catch (err) {
      logger.error({ err, sessionId: data.sessionId }, 'Failed to process manual end');
    }
    
    socket.leave(`interview:${data.sessionId}`);
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// ---- Error Handling ----

app.use(notFoundHandler);
app.use(errorHandler);

// ---- Start Server ----

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, '🚀 Proctara API server running');
});

export { app, httpServer, io };
