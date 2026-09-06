import 'server-only';

import { NextRequest } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini-server';
import type { AiProviderId } from '@/lib/api-key';

const PROVIDERS = new Set<AiProviderId>(['gemini', 'openai', 'anthropic', 'openrouter']);

export interface ProviderCredentials {
  provider: AiProviderId;
  apiKey: string;
}

interface ConversationPart {
  role: 'user' | 'model' | 'assistant';
  parts: Array<{ text?: string }>;
}

export function readProviderCredentials(req: NextRequest): ProviderCredentials {
  const rawProvider = (req.headers.get('x-ai-provider') || 'gemini').toLowerCase() as AiProviderId;
  const apiKey = (req.headers.get('x-ai-api-key') || req.headers.get('x-gemini-api-key') || '').trim();
  if (!PROVIDERS.has(rawProvider)) throw new Error('UNSUPPORTED_PROVIDER');
  if (apiKey.length < 16 || apiKey.length > 512 || /[\r\n]/.test(apiKey)) throw new Error('INVALID_PROVIDER_KEY');
  return { provider: rawProvider, apiKey };
}

function toMessages(contents: string | ConversationPart[], systemInstruction?: string) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
  } else {
    for (const item of contents) {
      const text = item.parts?.map((part) => part.text || '').join('').trim();
      if (text) messages.push({ role: item.role === 'model' ? 'assistant' : item.role, content: text });
    }
  }
  return messages;
}

export async function generateProviderText(options: {
  credentials: ProviderCredentials;
  contents: string | ConversationPart[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const { credentials, contents, systemInstruction, temperature = 0.7, maxOutputTokens = 2048, json = false } = options;
  if (credentials.provider === 'gemini') {
    return generateContentWithFallback({
      contents,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
      apiKey: credentials.apiKey,
    });
  }

  const messages = toMessages(contents, systemInstruction);
  if (credentials.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': credentials.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxOutputTokens,
        temperature,
        system: systemInstruction,
        messages: messages.filter((message) => message.role !== 'system'),
      }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`PROVIDER_REQUEST_FAILED:${response.status}`);
    const data = await response.json();
    const text = Array.isArray(data.content) ? data.content.map((item: { text?: string }) => item.text || '').join('').trim() : '';
    if (!text) throw new Error('EMPTY_PROVIDER_RESPONSE');
    return { text, modelUsed: 'claude-sonnet-4-6' };
  }

  const endpoint = credentials.provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = credentials.provider === 'openrouter' ? 'google/gemini-3.7-flash' : 'gpt-4.1-mini';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credentials.apiKey}`,
      ...(credentials.provider === 'openrouter' ? { 'HTTP-Referer': 'https://betterhuman.ai.studio', 'X-Title': 'BetterHuman' } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxOutputTokens, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`PROVIDER_REQUEST_FAILED:${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('EMPTY_PROVIDER_RESPONSE');
  return { text, modelUsed: model };
}

export function publicProviderError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'UNSUPPORTED_PROVIDER') return { message: 'The selected AI provider is not supported.', status: 400 };
  if (code === 'INVALID_PROVIDER_KEY') return { message: 'Connect a valid API key in AI Providers.', status: 401 };
  if (code.includes(':401') || code.includes(':403')) return { message: 'The provider rejected this API key. Check the key and its permissions.', status: 401 };
  if (code.includes(':429')) return { message: 'The provider rate limit was reached. Wait briefly or check provider quota.', status: 429 };
  return { message: 'The AI provider could not complete this request. Please try again.', status: 502 };
}
