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

// ---- App Setup ----

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.API_PORT || '3001', 10);

// Socket.io for real-time interview communication
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ---- Middleware ----

app.use(helmet());
app.use(cors({
  origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
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

  socket.on('interview:start', async (data: { sessionId: string }) => {
    const { sessionId } = data;
    socket.join(`interview:${sessionId}`);
    logger.info({ sessionId, socketId: socket.id }, 'Candidate joined interview room');

    // Emit welcome message and first question
    socket.emit('interview:question', {
      questionText: 'Welcome to your interview! Let\'s begin. Tell me about your experience with the technologies listed in the job description.',
      type: 'behavioral',
      sequenceNum: 1,
    });
  });

  socket.on('interview:answer', async (data: { sessionId: string; answerText: string }) => {
    const { sessionId, answerText } = data;
    logger.info({ sessionId, answerLength: answerText.length }, 'Answer received');

    // In production, this would:
    // 1. Save the response to DB
    // 2. Run AI evaluation via BullMQ job
    // 3. Generate next question adaptively
    // 4. Emit next question or completion

    // For now, acknowledge receipt
    socket.emit('interview:feedback', {
      received: true,
      message: 'Answer recorded. Generating next question...',
    });
  });

  socket.on('interview:code_submit', async (data: { sessionId: string; code: string; language: string }) => {
    logger.info({ sessionId: data.sessionId, language: data.language }, 'Code submission received');

    // In production, this would queue a BullMQ job for sandboxed execution
    socket.emit('interview:code_result', {
      status: 'processing',
      message: 'Running your code against test cases...',
    });
  });

  socket.on('interview:end', (data: { sessionId: string }) => {
    logger.info({ sessionId: data.sessionId }, 'Interview ended');
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
