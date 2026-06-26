// ============================================
// Proctara Groq AI Client
// Drop-in replacement for OpenAI using Groq API
// ============================================

import OpenAI, { toFile } from 'openai';
import logger from '../lib/logger';

/**
 * Groq uses an OpenAI-compatible API.
 * If GROQ_API_KEY is set, we use Groq's endpoint.
 * Otherwise, falls back to OpenAI if OPENAI_API_KEY is set.
 */
export function getAiClient(apiKey?: string): OpenAI {
  const finalKey = apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey || process.env.GROQ_API_KEY) {
    return new OpenAI({
      apiKey: finalKey || 'missing-key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  return new OpenAI({ apiKey: finalKey || 'missing-key' });
}

export const aiClient = getAiClient();

/**
 * Returns the best available model name.
 * Groq: llama-3.3-70b-versatile (fast + capable)
 * OpenAI: gpt-4o
 */
export function getModel(apiKey?: string): string {
  if (apiKey || process.env.GROQ_API_KEY) {
    return 'llama-3.3-70b-versatile';
  }
  return 'gpt-4o';
}

/**
 * Returns a fast model for quick tasks (follow-up question gen, etc.)
 */
export function getFastModel(apiKey?: string): string {
  if (apiKey || process.env.GROQ_API_KEY) {
    return 'llama-3.1-8b-instant';
  }
  return 'gpt-4o-mini';
}

/**
 * Transcribes an audio buffer using Whisper.
 */
export async function transcribeAudioBuffer(buffer: Buffer, apiKey?: string): Promise<string> {
  const client = getAiClient(apiKey);
  const isGroq = !!(apiKey || process.env.GROQ_API_KEY);
  
  // Wrap the buffer in an OpenAI File object (in-memory, no disk I/O)
  const file = await toFile(buffer, 'audio.webm', { type: 'audio/webm' });

  const response = await client.audio.transcriptions.create({
    file,
    model: isGroq ? 'whisper-large-v3-turbo' : 'whisper-1',
    response_format: 'text',
  });

  return response as unknown as string;
}

export default aiClient;

