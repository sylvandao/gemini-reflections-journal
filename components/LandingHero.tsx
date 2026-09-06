'use client';

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Bot,
  BookMarked,
  CheckCircle2,
  ArrowRight,
  BrainCircuit,
  FileText,
  Compass
} from 'lucide-react';

interface LandingHeroProps {
  onSignIn: () => void;
  isLoading: boolean;
}

export function LandingHero({ onSignIn, isLoading }: LandingHeroProps) {
  return (
    <div className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
      {/* Subtle glowing background accents */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-amber-500/10 via-indigo-500/10 to-amber-400/5 blur-3xl" />

      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">

        {/* Security badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-xs font-medium text-zinc-300 shadow-xs backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>User-Isolated Cloud Firestore Persistence & Firebase Auth</span>
        </div>

        {/* Headline */}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Converse, Reflect, and Distill Thoughts with{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-100 bg-clip-text text-transparent drop-shadow-sm">
            Your AI
          </span>
        </h1>

        {/* Subhead */}
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          A private, authenticated sanctuary for multi-turn reflection dialogues. Bring a key from Gemini, OpenAI, Anthropic, or OpenRouter and turn raw thoughts into structured insights and action plans.
        </p>

        {/* Primary CTA */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            id="btn-landing-signin-google"
            onClick={onSignIn}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.15)] transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 sm:w-auto"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
            )}
            <span>Sign In with Google to Open Journal</span>
            <ArrowRight className="h-4 w-4 text-zinc-600" />
          </button>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div
            id="feature-card-conversations"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-sm backdrop-blur-xl hover:border-white/20 transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              Multi-Turn Reflections
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Engage in multi-turn dialogues with specialized modes: Socratic Inquiry, Deep Reflection, Action Planning, and Creative Brainstorming.
            </p>
          </div>

          <div
            id="feature-card-summaries"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-sm backdrop-blur-xl hover:border-white/20 transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-zinc-200 border border-white/15">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              AI Insight Distillation
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Instantly transform long journaling sessions into structured takeaways, identified moods, and high-leverage action items.
            </p>
          </div>

          <div
            id="feature-card-security"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-sm backdrop-blur-xl hover:border-white/20 transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">
              Strict User Isolation
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Protected by Cloud Firestore security rules. Your reflections and prompt records are isolated exclusively to your authenticated user account.
            </p>
          </div>
        </div>

        {/* Security & Architecture Guarantee Section */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left backdrop-blur-md">
          <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Zero-Trust Architectural Foundation
          </h4>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-400 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Direct Firebase Google Authentication (No stored credentials)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Owner-bound rules: <code className="bg-white/10 text-amber-300 px-1 py-0.5 rounded border border-white/10">request.auth.uid == userId</code>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Stable Gemini fallback ladder (3.7 Flash &rarr; 3.6 Flash &rarr; Flash Lite)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Zero-crash payload sanitation (Strict undefined-stripping)
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
