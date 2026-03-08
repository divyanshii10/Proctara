// ============================================
// Proctara Shared Types
// Used across frontend (Next.js) and backend (Express)
// ============================================

// ---- Enums ----

export type PlanType = 'free' | 'pro' | 'enterprise';
export type UserRole = 'owner' | 'admin' | 'member';
export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'staff';
export type JobStatus = 'active' | 'paused' | 'archived';
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
export type QuestionType = 'technical' | 'behavioral' | 'coding' | 'system_design';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Recommendation = 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
export type CodeLanguage = 'javascript' | 'python' | 'java' | 'cpp' | 'go';

// ---- Core Entities ----

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: PlanType;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyUser {
  id: string;
  companyId: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: Date;
}

export interface Candidate {
  id: string;
  email: string;
  name?: string;
  resumeUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface JobRole {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  skills: string[];
  level?: SeniorityLevel;
  status: JobStatus;
  createdAt: Date;
}

export interface InterviewTemplate {
  id: string;
  jobRoleId: string;
  name: string;
  durationMin: number;
  config: InterviewConfig;
  createdAt: Date;
}

export interface InterviewConfig {
  topics: string[];
  questionCount: number;
  codingChallenges: number;
  difficulty: Difficulty;
  llmModel?: string;
}

export interface Question {
  id: string;
  companyId?: string;
  type: QuestionType;
  difficulty?: Difficulty;
  topic?: string;
  content: string;
  rubric?: RubricCriteria[];
  testCases?: TestCase[];
  createdAt: Date;
}

export interface RubricCriteria {
  name: string;
  description: string;
  weight: number; // 0-1
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  jobRoleId: string;
  templateId: string;
  companyId: string;
  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationSec?: number;
  inviteToken: string;
  trustScore?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Response {
  id: string;
  sessionId: string;
  questionId?: string;
  questionText: string;
  answerText?: string;
  answerAudioUrl?: string;
  sequenceNum: number;
  durationSec?: number;
  aiScore?: number;
  aiFeedback?: AIFeedback;
  createdAt: Date;
}

export interface AIFeedback {
  technicalAccuracy: { score: number; evidence: string };
  depth: { score: number; evidence: string };
  problemSolving: { score: number; evidence: string };
  communication: { score: number; evidence: string };
  overallScore: number;
  followUpNeeded: boolean;
  suggestedFollowUp?: string;
  nextDifficulty: 'easier' | 'same' | 'harder';
}

export interface CodeSubmission {
  id: string;
  sessionId: string;
  questionId?: string;
  language: CodeLanguage;
  sourceCode: string;
  testResults?: TestResults;
  executionTimeMs?: number;
  memoryKb?: number;
  createdAt: Date;
}

export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  details: TestCaseResult[];
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTimeMs: number;
}

export interface Evaluation {
  id: string;
  sessionId: string;
  overallScore: number;
  recommendation: Recommendation;
  scores: Record<string, number>;
  summary?: string;
  strengths: string[];
  weaknesses: string[];
  reportUrl?: string;
  createdAt: Date;
}

// ---- API Types ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ---- WebSocket Events ----

export interface WSEvents {
  // Client → Server
  'interview:start': { sessionId: string };
  'interview:answer': { sessionId: string; answerText: string };
  'interview:code_submit': { sessionId: string; code: string; language: CodeLanguage };
  'interview:end': { sessionId: string };

  // Server → Client
  'interview:question': { questionText: string; type: QuestionType; sequenceNum: number };
  'interview:feedback': AIFeedback;
  'interview:code_result': TestResults;
  'interview:complete': { evaluationId: string };
  'interview:error': { message: string };
}
