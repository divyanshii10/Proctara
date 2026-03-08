// ============================================
// Proctara AI Evaluation Service
// Core AI engine that powers interview evaluation
// ============================================

import { aiClient, getModel } from './groqClient';
import logger from '../lib/logger';

// ---- Types ----

interface EvaluationInput {
  roleTitle: string;
  companyName: string;
  seniorityLevel: string;
  questionTopic: string;
  questionText: string;
  rubricCriteria: string;
  answerText: string;
}

interface EvaluationResult {
  technicalAccuracy: { score: number; evidence: string };
  depth: { score: number; evidence: string };
  problemSolving: { score: number; evidence: string };
  communication: { score: number; evidence: string };
  overallScore: number;
  followUpNeeded: boolean;
  suggestedFollowUp: string | null;
  nextDifficulty: 'easier' | 'same' | 'harder';
}

interface QuestionGenerationInput {
  roleTitle: string;
  seniorityLevel: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  previousQuestions: string[];
  previousScores: number[];
  type: 'technical' | 'behavioral' | 'coding' | 'system_design';
}

interface GeneratedQuestion {
  questionText: string;
  type: string;
  difficulty: string;
  topic: string;
  rubric: Array<{ name: string; description: string; weight: number }>;
  expectedDurationSec: number;
}

// ---- Evaluation ----

/**
 * Evaluate a candidate's answer using AI (Groq or OpenAI).
 * Uses structured output (JSON mode) and temperature 0 for deterministic scoring.
 * Bias mitigation: No candidate identifying info is included in the prompt.
 */
export async function evaluateAnswer(input: EvaluationInput): Promise<EvaluationResult> {
  const model = getModel();

  const systemPrompt = `You are an expert technical interviewer evaluating a candidate's response.
You must be fair, objective, and score ONLY based on the technical content of the answer.

RULES:
- Score ONLY based on content. Do NOT consider grammar, accent markers, or writing style.
- Provide specific evidence from the response for each score.
- If the response is ambiguous, note what follow-up question would clarify.
- Be calibrated: 1-3 is poor, 4-5 is below average, 6-7 is good, 8-9 is excellent, 10 is exceptional.
- Output valid JSON only matching the specified schema.`;

  const userPrompt = `CONTEXT:
- Role: ${input.roleTitle}
- Level: ${input.seniorityLevel}
- Topic: ${input.questionTopic}
- Question: ${input.questionText}
- Rubric: ${input.rubricCriteria}

CANDIDATE RESPONSE:
${input.answerText}

EVALUATE on these dimensions (1-10 each):
1. **Technical Accuracy** — Is the answer factually correct?
2. **Depth of Understanding** — Does the candidate show deep vs surface knowledge?
3. **Problem-Solving Approach** — Is their methodology sound?
4. **Communication Clarity** — Is the explanation clear and structured?

Output JSON:
{
  "technicalAccuracy": { "score": N, "evidence": "..." },
  "depth": { "score": N, "evidence": "..." },
  "problemSolving": { "score": N, "evidence": "..." },
  "communication": { "score": N, "evidence": "..." },
  "overallScore": N,
  "followUpNeeded": true/false,
  "suggestedFollowUp": "..." or null,
  "nextDifficulty": "easier"|"same"|"harder"
}`;

  try {
    const response = await aiClient.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

    const result = JSON.parse(content) as EvaluationResult;

    // Validate score ranges (hallucination prevention)
    const dimensions = ['technicalAccuracy', 'depth', 'problemSolving', 'communication'] as const;
    for (const dim of dimensions) {
      const score = result[dim]?.score;
      if (typeof score !== 'number' || score < 1 || score > 10) {
        logger.warn({ dimension: dim, score }, 'Invalid score from LLM, clamping');
        result[dim].score = Math.max(1, Math.min(10, Math.round(score || 5)));
      }
    }

    // Validate overall score
    if (typeof result.overallScore !== 'number' || result.overallScore < 1 || result.overallScore > 10) {
      result.overallScore = Math.round(
        dimensions.reduce((sum, dim) => sum + result[dim].score, 0) / dimensions.length
      );
    }

    logger.info({ overallScore: result.overallScore, followUp: result.followUpNeeded, model }, 'Answer evaluated');
    return result;
  } catch (err) {
    logger.error({ err }, 'AI evaluation failed');
    throw new Error(`AI evaluation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// ---- Adaptive Question Generation ----

/**
 * Generate the next interview question adaptively based on previous performance.
 * Adjusts difficulty and topic based on candidate's scores.
 */
export async function generateNextQuestion(input: QuestionGenerationInput): Promise<GeneratedQuestion> {
  const model = getModel();

  const avgScore = input.previousScores.length > 0
    ? input.previousScores.reduce((a, b) => a + b, 0) / input.previousScores.length
    : 5;

  // Adaptive difficulty logic
  let targetDifficulty = input.difficulty;
  if (avgScore >= 8) targetDifficulty = 'hard';
  else if (avgScore >= 5) targetDifficulty = 'medium';
  else targetDifficulty = 'easy';

  const systemPrompt = `You are an expert technical interviewer designing interview questions.
Create questions that are fair, practical, and test real-world skills.
Do NOT create trick questions or language-specific gotchas.
Output valid JSON only.`;

  const userPrompt = `Generate a ${input.type} interview question.

CONTEXT:
- Role: ${input.roleTitle} (${input.seniorityLevel})
- Topic: ${input.topic}
- Target Difficulty: ${targetDifficulty}
- Previous questions asked (avoid repetition): ${JSON.stringify(input.previousQuestions.slice(-5))}
- Candidate's average score so far: ${avgScore.toFixed(1)}/10

${input.type === 'coding' ? `
For coding questions:
- Provide a clear problem statement
- Include example input/output
- Specify time complexity expectation
` : ''}

Output JSON:
{
  "questionText": "The full question to ask the candidate",
  "type": "${input.type}",
  "difficulty": "${targetDifficulty}",
  "topic": "${input.topic}",
  "rubric": [
    { "name": "criterion_name", "description": "what to evaluate", "weight": 0.25 }
  ],
  "expectedDurationSec": N
}`;

  try {
    const response = await aiClient.chat.completions.create({
      model,
      temperature: 0.7, // Slightly creative for question variety
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

    const question = JSON.parse(content) as GeneratedQuestion;
    logger.info({ topic: input.topic, difficulty: targetDifficulty, type: input.type, model }, 'Question generated');
    return question;
  } catch (err) {
    logger.error({ err }, 'Question generation failed');
    throw new Error(`Question generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// ---- Final Evaluation Report ----

interface SessionSummaryInput {
  roleTitle: string;
  seniorityLevel: string;
  responses: Array<{
    questionText: string;
    answerText: string;
    score: number;
    feedback: Record<string, unknown>;
  }>;
  codingResults?: Array<{
    passed: number;
    total: number;
    language: string;
  }>;
}

interface SessionReport {
  overallScore: number;
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  scores: Record<string, number>;
}

/**
 * Generate a final evaluation report for an entire interview session.
 */
export async function generateSessionReport(input: SessionSummaryInput): Promise<SessionReport> {
  const model = getModel();

  const systemPrompt = `You are an expert hiring committee member synthesizing interview results.
Provide a fair, evidence-based overall evaluation.
Your recommendation directly impacts hiring decisions — be thorough and calibrated.

Scoring guide:
- 90-100: Exceptional — hire immediately (strong_yes)
- 75-89: Strong — likely hire (yes)  
- 60-74: Mixed signals — additional interview recommended (maybe)
- 40-59: Below bar — do not proceed (no)
- 0-39: Significantly below bar (strong_no)

Output valid JSON only.`;

  const responseSummary = input.responses.map((r, i) =>
    `Q${i + 1}: "${r.questionText}"\nA: "${r.answerText}"\nScore: ${r.score}/10`
  ).join('\n\n');

  const codingSummary = input.codingResults
    ? input.codingResults.map((c, i) => `Challenge ${i + 1}: ${c.passed}/${c.total} tests passed (${c.language})`).join('\n')
    : 'No coding challenges';

  const userPrompt = `INTERVIEW SUMMARY:
Role: ${input.roleTitle} (${input.seniorityLevel})

RESPONSES:
${responseSummary}

CODING RESULTS:
${codingSummary}

Generate a comprehensive evaluation report.

Output JSON:
{
  "overallScore": N (0-100),
  "recommendation": "strong_yes"|"yes"|"maybe"|"no"|"strong_no",
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "scores": {
    "technicalSkills": N (0-100),
    "problemSolving": N (0-100),
    "communication": N (0-100),
    "codingAbility": N (0-100)
  }
}`;

  try {
    const response = await aiClient.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    const report = JSON.parse(content) as SessionReport;

    // Validate score range
    report.overallScore = Math.max(0, Math.min(100, Math.round(report.overallScore)));

    logger.info({ overallScore: report.overallScore, recommendation: report.recommendation, model }, 'Session report generated');
    return report;
  } catch (err) {
    logger.error({ err }, 'Session report generation failed');
    throw new Error(`Report generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
