'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { AI_PROVIDERS, AiProviderId, useApiKey } from '@/lib/api-key';

export function ProviderSettings() {
  const { provider, setProvider, getKeyForProvider, saveKey, clearKey } = useApiKey();
  const [input, setInput] = useState(() => getKeyForProvider(provider));
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = AI_PROVIDERS.find((item) => item.id === provider)!;

  const selectProvider = (nextProvider: AiProviderId) => {
    setProvider(nextProvider);
    setInput(getKeyForProvider(nextProvider));
    setMessage(null);
    setShowKey(false);
  };

  const connect = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = input.trim();
    if (clean.length < 16 || clean.length > 512) {
      setMessage('Enter a valid provider API key (16–512 characters).');
      return;
    }
    saveKey(clean, provider);
    setMessage(`${selected.name} is connected for this tab.`);
  };

  const remove = () => {
    clearKey(provider);
    setInput('');
    setMessage(`${selected.name} key removed.`);
  };

  return (
    <section className="flex-1 overflow-y-auto p-4 sm:p-8" aria-labelledby="provider-settings-title">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-300"><KeyRound className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">API key installation</p>
            <h1 id="provider-settings-title" className="mt-1 text-2xl font-bold text-white">Connect your AI provider</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Choose a provider, create a key on its official website, and paste it below. BetterHuman keeps the key only in this browser tab’s memory and clears it on refresh or close.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="AI providers">
          {AI_PROVIDERS.map((item) => {
            const connected = Boolean(getKeyForProvider(item.id));
            const active = provider === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectProvider(item.id as AiProviderId)}
                className={`relative rounded-2xl border p-4 text-left transition ${active ? 'border-amber-400/60 bg-amber-400/10 ring-1 ring-amber-400/30' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                {item.recommended && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-950">Recommended</span>}
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {item.recommended ? <Sparkles className="h-4 w-4 text-amber-300" /> : <KeyRound className="h-4 w-4 text-zinc-400" />}
                  {item.name}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{item.description}</p>
                <p className={`mt-3 text-[10px] font-semibold ${connected ? 'text-emerald-400' : 'text-zinc-500'}`}>{connected ? 'Connected' : 'Not connected'}</p>
              </button>
            );
          })}
        </div>

        <form onSubmit={connect} className="mt-5 rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.name} API key</h2>
              <p className="mt-1 text-xs text-zinc-400">{selected.supportsNativeVoice ? 'Text, summaries, transcription, and Gemini voice are supported.' : 'Text and summaries are supported. Voice playback uses your browser.'}</p>
            </div>
            <a href={selected.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-300">
              <span>{selected.id === 'gemini' ? 'Input free key' : `Create ${selected.name} key`}</span><ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {selected.id === 'gemini' && (
            <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 text-xs text-zinc-300">
              <p className="font-semibold text-amber-300">Free Gemini setup</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-zinc-400"><li>Open Google AI Studio with “Input free key”.</li><li>Select Create API key and copy it.</li><li>Paste it here and choose Connect provider.</li></ol>
            </div>
          )}

          <label htmlFor="provider-api-key" className="mt-5 block text-xs font-semibold text-zinc-300">API key</label>
          <div className="relative mt-2">
            <input id="provider-api-key" type={showKey ? 'text' : 'password'} value={input} onChange={(event) => { setInput(event.target.value); setMessage(null); }} autoComplete="off" spellCheck={false} placeholder={selected.keyPrefix ? `${selected.keyPrefix}…` : 'Paste provider key'} className="w-full rounded-xl border border-white/15 bg-black/50 px-4 py-3 pr-12 font-mono text-sm text-white outline-none focus:border-amber-400" />
            <button type="button" onClick={() => setShowKey((value) => !value)} className="absolute right-3 top-3 text-zinc-400 hover:text-white" aria-label={showKey ? 'Hide API key' : 'Show API key'}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 text-[11px] text-emerald-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Never written to cookies, local storage, Firestore, logs, or the repository.</span></div>
            <div className="flex gap-2">
              {getKeyForProvider(provider) && <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" />Remove</button>}
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-zinc-200"><CheckCircle2 className="h-3.5 w-3.5" />Connect provider</button>
            </div>
          </div>
          {message && <p className="mt-3 text-xs text-amber-300" role="status">{message}</p>}
        </form>
      </div>
    </section>
  );
}
