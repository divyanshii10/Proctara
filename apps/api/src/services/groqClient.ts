// ============================================
// Proctara Groq AI Client
// Drop-in replacement for OpenAI using Groq API
// ============================================

import OpenAI from 'openai';
import logger from '../lib/logger';

/**
 * Groq uses an OpenAI-compatible API.
 * If GROQ_API_KEY is set, we use Groq's endpoint.
 * Otherwise, falls back to OpenAI if OPENAI_API_KEY is set.
 */
function createAIClient(): OpenAI {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey) {
    logger.info('Using Groq AI backend');
    return new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  if (openaiKey) {
    logger.info('Using OpenAI backend');
    return new OpenAI({ apiKey: openaiKey });
  }

  logger.warn('No AI API key found — set GROQ_API_KEY or OPENAI_API_KEY');
  return new OpenAI({ apiKey: 'missing-key' });
}

export const aiClient = createAIClient();

/**
 * Returns the best available model name.
 * Groq: llama-3.3-70b-versatile (fast + capable)
 * OpenAI: gpt-4o
 */
export function getModel(): string {
  if (process.env.GROQ_API_KEY) {
    return 'llama-3.3-70b-versatile';
  }
  return 'gpt-4o';
}

/**
 * Returns a fast model for quick tasks (follow-up question gen, etc.)
 */
export function getFastModel(): string {
  if (process.env.GROQ_API_KEY) {
    return 'llama-3.1-8b-instant';
  }
  return 'gpt-4o-mini';
}

export default aiClient;
