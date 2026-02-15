/**
 * Server-only OpenAI client wrapper.
 * Import only in route handlers / server code. Never in client components.
 */

import OpenAI from 'openai';

const CONFIGURED_ERR = 'AI is not configured. Set OPENAI_API_KEY in Railway → Variables, then redeploy.';

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
}

export function isAIEnabled(): boolean {
  return process.env.AI_FEATURES_ENABLED === 'true' || process.env.AI_FEATURES_ENABLED === '1';
}

export function isConfigured(): boolean {
  return !!getApiKey();
}

/**
 * Returns OpenAI client or null if not configured.
 * Does not throw; use assertAIEnabled() when you need to fail fast.
 */
export function getOpenAIClient(): OpenAI | null {
  const key = getApiKey();
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    organization: process.env.OPENAI_ORG_ID || undefined,
    project: process.env.OPENAI_PROJECT_ID || undefined
  });
}

/**
 * Throws a friendly error if AI is not configured.
 * Use before performing AI operations.
 */
export function assertAIEnabled(): void {
  if (!isAIEnabled()) {
    throw new Error(CONFIGURED_ERR);
  }
  if (!getApiKey()) {
    throw new Error(CONFIGURED_ERR);
  }
}

export function getOpenAIModel(): string {
  return getModel();
}
