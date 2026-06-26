import prisma from '../lib/prisma';
import { getAiClient, getModel } from './groqClient';
import { sendEvaluationReportEmail } from './emailService';
import logger from '../lib/logger';
import { generateSessionReport } from './aiEvaluation';

/**
 * Generate the first question/intro of the interview.
 */
export async function generateInitialQuestion(
  jd: string,
  resume: string,
  roleTitle: string,
  tone: string = 'professional',
  groqApiKey?: string,
  transcript: string = 'yes'
): Promise<string> {
  const client = getAiClient(groqApiKey);
  const model = getModel(groqApiKey);

  const systemPrompt = `You are "Jordan", an elite, deeply conversational AI technical interviewer for Proctara. 

You must strictly follow this conversational state machine. Do not skip phases.

PHASE 1: THE LAUNCH (First Turn)
If the user input is a confirmation (e.g., 'Yes', 'Sure', 'Ready') OR if the payload contains '[System: Candidate confirmed ready]', you MUST immediately acknowledge their readiness and ask the first technical question based heavily on their specific resume projects. Do NOT ask if they have any questions or wait for further input.
Example: "Perfect, let's begin. Looking at your resume, I see you built [Project] using [Tech]..."
- Do NOT generate any rules or proctoring instructions.
- CRITICAL: If the resume is missing, empty, or says 'No resume available', do NOT mention that you don't have their resume. Just ask a general question about their most recent technical project.

OUTPUT FORMAT:
Always return a JSON object:
{
  "currentPhase": "LAUNCH",
  "speechOutput": "[Your conversational text here]"
}`;

  const userPrompt = `JOB DESCRIPTION (JD):
${jd}

CANDIDATE RESUME:
${resume}

CANDIDATE TRANSCRIPT:
${transcript}

Generate Phase 2 Launch Question:`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    logger.error({ err }, 'Failed to generate initial question');
    return JSON.stringify({
      currentPhase: 'LAUNCH',
      speechOutput: `Perfect, let's begin. I see from your resume that you have experience with relevant technologies. Could you walk me through your background and your most recent project?`
    });
  }
}

/**
 * Generate the next follow-up question.
 */
export async function generateFollowUpQuestion(
  jd: string,
  resume: string,
  roleTitle: string,
  tone: string = 'professional',
  history: Array<{ questionText: string; answerText: string }>,
  groqApiKey?: string
): Promise<string> {
  const client = getAiClient(groqApiKey);
  const model = getModel(groqApiKey);

  const systemPrompt = `You are "Jordan", an elite, concise, and realistic human technical interviewer for Proctara. 

You must strictly follow this conversational state machine. Do not skip phases.

PHASE 2: DYNAMIC INTERVIEW (Active Q&A)
- You must adapt dynamically to the candidate's input.
- If the candidate gives a complete answer to your previous question, briefly acknowledge it and ask a NEW technical follow-up question.
- If the candidate asks a clarifying question, answer it concisely. Do NOT move on to a new topic yet.
- If the candidate asks for time to think or a break (e.g., 'can I take 5 minutes'), reply naturally like a human: 'Take your time, let me know when you are ready.' Do NOT ask a new question in this case.
- CRITICAL: Act like a fast-paced, concise human interviewer. Keep your entire response under 2-3 sentences. Avoid repeating their answers.

PHASE 3: SILENCE TIMEOUT
- If the user payload is exactly '[System: Timeout - Candidate remained silent]', pivot to a fundamental question: 'Let's try a different direction. Tell me about...'

OUTPUT FORMAT:
Always return a JSON object:
{
  "currentPhase": "LAUNCH" | "INTERVIEW" | "TIMEOUT",
  "speechOutput": "[Your conversational text here]"
}`;

  const historyText = history
    .map((h) => {
      let qText = h.questionText;
      try {
        const parsed = JSON.parse(h.questionText);
        qText = `(Phase: ${parsed.currentPhase}) Jordan: ${parsed.speechOutput}`;
      } catch (e) {
        qText = `Jordan: ${h.questionText}`;
      }
      return `${qText}\nCandidate: ${h.answerText}`;
    })
    .join('\n\n');

  const userPrompt = `JOB DESCRIPTION (JD):
${jd}

CANDIDATE RESUME:
${resume}

CONVERSATION HISTORY:
${historyText}

Determine the current phase, process the candidate's last response, and generate Jordan's next response:`;

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (err) {
    logger.error({ err }, 'Failed to generate follow-up question');
    return JSON.stringify({
      currentPhase: 'INTERVIEW',
      speechOutput: 'Thank you for that response. Can you elaborate further on your experience?'
    });
  }
}

/**
 * Evaluate the interview session and save evaluation to the DB.
 */
export async function evaluateSessionAndSave(
  sessionId: string,
  groqApiKey?: string
): Promise<any> {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        jobRole: true,
        candidate: true,
        campaign: true,
        responses: { orderBy: { sequenceNum: 'asc' } },
      },
    });

    if (!session) {
      throw new Error(`Interview session ${sessionId} not found`);
    }

    const answeredResponses = session.responses.filter(r => r.answerText);
    if (answeredResponses.length === 0) {
      // Create empty evaluation if no questions were answered
      return await prisma.evaluation.create({
        data: {
          sessionId,
          overallScore: 0,
          recommendation: 'no',
          scores: { technicalSkills: 0, problemSolving: 0, communication: 0 },
          summary: 'Candidate did not provide any responses.',
        },
      });
    }

    // Calculate Trust Score based on proctoring violations and early quit
    let trustScorePercentage = 100;
    const meta = (session.metadata as any) || {};
    const violations: Array<{type: string, timestamp: string}> = meta.violations || [];

    for (const v of violations) {
      if (v.type === 'fullscreen_exit' || v.type === 'tab_switch') trustScorePercentage -= 10;
      else if (v.type === 'no_face_detected') trustScorePercentage -= 15;
      else if (v.type === 'multiple_faces' || v.type === 'phone_detected') trustScorePercentage -= 25;
      else if (v.type === 'audio_visual_mismatch') trustScorePercentage -= 40;
      else if (v.type === 'looking_away') trustScorePercentage -= 5;
    }

    // Early Quit Penalty (If they quit before answering at least 3 actual questions)
    // Remember sequence 1 is usually the handshake/intro
    if (answeredResponses.length < 3) {
      trustScorePercentage -= 50;
      logger.warn({ sessionId }, 'Candidate quit early. Applied heavy trust score penalty.');
    }

    trustScorePercentage = Math.max(0, Math.min(100, trustScorePercentage));
    const trustScoreDecimal = trustScorePercentage / 100;

    // Save trustScore to session
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { trustScore: trustScoreDecimal }
    });

    // Prepare inputs for session summary
    const formattedResponses = answeredResponses.map(r => ({
      questionText: r.questionText,
      answerText: r.answerText || '',
      score: 7, // Placeholder or basic default for subscores
      feedback: {},
    }));

    const reportInput = {
      roleTitle: session.jobRole.title,
      seniorityLevel: 'mid', // default
      responses: formattedResponses,
      violations: violations.map(v => v.type),
    };

    const report = await generateSessionReport(reportInput);

    // Save report to database
    const evaluation = await prisma.evaluation.create({
      data: {
        sessionId,
        overallScore: report.overallScore,
        recommendation: report.overallScore >= 75 ? 'yes' : 'no', // Fallback for schema requirement
        scores: {
          transcriptAnalysis: report.transcriptAnalysis,
        },
        summary: report.summary,
        strengths: report.strengths,
        weaknesses: report.areasForImprovement,
      },
    });

    // Dispatch the email report notification
    await sendEvaluationReportEmail(session, evaluation);

    return evaluation;
  } catch (err) {
    logger.error({ err, sessionId }, 'Error evaluating session');
    // Fallback save so candidate doesn't hang
    return await prisma.evaluation.create({
      data: {
        sessionId,
        overallScore: -1,
        recommendation: 'error',
        scores: { error: true, details: err instanceof Error ? err.message : 'Unknown LLM failure' },
        summary: 'CRITICAL ERROR: AI Evaluation server failed to process the interview transcript. Please review the responses manually.',
      },
    });
  }
}
