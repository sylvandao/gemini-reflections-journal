'use client';

import { auth } from '@/lib/firebase';
import { getActiveAiProvider } from '@/lib/api-key';

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  options: { includeAiProvider?: boolean } = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (options.includeAiProvider) {
    const { provider, apiKey } = getActiveAiProvider();
    headers.set('x-ai-provider', provider);
    headers.set('x-ai-api-key', apiKey);
  }

  return fetch(input, { ...init, headers });
}
