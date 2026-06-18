import { z } from 'zod';
import { SYSTEM_PROMPT } from './prompts';

// DeepSeek (OpenAI-compatible) client. Swap to GPT-4o/Claude by changing these two.
export const LLM_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
export const LLM_MODEL = 'deepseek-chat';

// 1–2 s simulated latency for demo-mode / mock realism.
export function simulatedLatency(): Promise<void> {
  const ms = 1000 + Math.random() * 1000;
  return new Promise((r) => setTimeout(r, ms));
}

export type CallMeta = { mode: 'live' | 'demo' | 'fallback'; latencyMs: number };

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

async function rawCall(apiKey: string, userPrompt: string, corrective = false): Promise<string> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  if (corrective) {
    messages.push({
      role: 'user',
      content: 'Ta réponse précédente n’était pas un JSON valide. Réponds UNIQUEMENT avec un objet JSON valide.',
    });
  }
  const res = await fetch(LLM_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: LLM_MODEL, messages, temperature: 0.4, max_tokens: 900 }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Validated LLM call with the docs/09 policy:
 *  - no key            -> demo mode: simulated latency, return mock
 *  - key present       -> real call, validate with zod
 *    - parse/zod fail  -> retry once with corrective reminder
 *    - second fail     -> fall back to mock + console.warn
 */
export async function callLLM<T>(
  opts: {
    apiKey: string | null;
    prompt: string;
    schema: z.ZodType<T>;
    mock: T;
  },
): Promise<{ data: T; meta: CallMeta }> {
  const start = performance.now();

  if (!opts.apiKey) {
    await simulatedLatency();
    return { data: opts.mock, meta: { mode: 'demo', latencyMs: performance.now() - start } };
  }

  try {
    const raw = await rawCall(opts.apiKey, opts.prompt);
    try {
      const parsed = opts.schema.parse(extractJson(raw));
      return { data: parsed, meta: { mode: 'live', latencyMs: performance.now() - start } };
    } catch {
      // retry once
      const raw2 = await rawCall(opts.apiKey, opts.prompt, true);
      const parsed2 = opts.schema.parse(extractJson(raw2));
      return { data: parsed2, meta: { mode: 'live', latencyMs: performance.now() - start } };
    }
  } catch (err) {
    console.warn('[APDA] LLM call failed, falling back to mock:', err);
    return { data: opts.mock, meta: { mode: 'fallback', latencyMs: performance.now() - start } };
  }
}
