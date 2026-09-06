'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface AiProviderDefinition {
  id: AiProviderId;
  name: string;
  description: string;
  keyUrl: string;
  keyPrefix?: string;
  recommended?: boolean;
  supportsNativeVoice: boolean;
}

export const AI_PROVIDERS: readonly AiProviderDefinition[] = [
  { id: 'gemini', name: 'Google Gemini', description: 'Recommended for the complete BetterHuman experience, including Gemini voice.', keyUrl: 'https://aistudio.google.com/api-keys', keyPrefix: 'AIza', recommended: true, supportsNativeVoice: true },
  { id: 'openai', name: 'OpenAI', description: 'Use an OpenAI API key for reflections and summaries.', keyUrl: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-', supportsNativeVoice: false },
  { id: 'anthropic', name: 'Anthropic', description: 'Use a Claude API key for reflections and summaries.', keyUrl: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-', supportsNativeVoice: false },
  { id: 'openrouter', name: 'OpenRouter', description: 'Use one key to access supported models through OpenRouter.', keyUrl: 'https://openrouter.ai/settings/keys', keyPrefix: 'sk-or-', supportsNativeVoice: false },
] as const;

export interface ActiveAiProvider {
  provider: AiProviderId;
  apiKey: string;
}

let activeProvider: AiProviderId = 'gemini';
const keysInMemory: Partial<Record<AiProviderId, string>> = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): string {
  return `${activeProvider}:${keysInMemory[activeProvider] || ''}`;
}

export function getActiveAiProvider(): ActiveAiProvider {
  return { provider: activeProvider, apiKey: keysInMemory[activeProvider] || '' };
}

export function setActiveAiProvider(provider: AiProviderId): void {
  activeProvider = provider;
  notifyListeners();
}

export function setProviderApiKey(provider: AiProviderId, key: string): void {
  keysInMemory[provider] = key.trim();
  activeProvider = provider;
  notifyListeners();
}

export function clearProviderApiKey(provider: AiProviderId): void {
  delete keysInMemory[provider];
  notifyListeners();
}

/**
 * Masks an API key for safe UI display (e.g. AIza...4feL)
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/**
 * React hook to reactively track the user's custom AI Studio API key state.
 */
export function useApiKey() {
  useSyncExternalStore(subscribe, getSnapshot, () => 'gemini:');
  const active = getActiveAiProvider();

  const saveKey = useCallback((newKey: string, provider: AiProviderId = activeProvider) => {
    setProviderApiKey(provider, newKey);
  }, []);

  const clearKey = useCallback((provider: AiProviderId = activeProvider) => {
    clearProviderApiKey(provider);
  }, []);

  return {
    provider: active.provider,
    providerDefinition: AI_PROVIDERS.find((item) => item.id === active.provider)!,
    apiKey: active.apiKey,
    hasApiKey: Boolean(active.apiKey),
    maskedKey: maskApiKey(active.apiKey),
    saveKey,
    clearKey,
    setProvider: setActiveAiProvider,
    getKeyForProvider: (provider: AiProviderId) => keysInMemory[provider] || '',
    isLoaded: true,
  };
}
