'use client';

import React from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceOrbProps {
  state: VoiceState;
  audioLevel?: number; // 0.0 to 1.0
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export function VoiceOrb({
  state,
  audioLevel = 0,
  onClick,
  size = 'hero',
}: VoiceOrbProps) {
  // Dimensions
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
    hero: 'w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96',
  }[size];

  // Dynamic scale calculation based on audio energy
  const dynamicScale = Math.min(1.35, 1 + audioLevel * 0.4);
  const glowScale = Math.min(1.6, 1 + audioLevel * 0.65);
  const ringScale1 = 1 + (state === 'listening' || state === 'speaking' ? audioLevel * 0.5 : 0);
  const ringScale2 = 1.15 + (state === 'listening' || state === 'speaking' ? audioLevel * 0.7 : 0);

  return (
    <div
      id="chatgpt-voice-orb-interactive"
      onClick={onClick}
      className={`relative cursor-pointer select-none flex items-center justify-center transition-transform duration-150 ease-out ${sizeClasses}`}
      role="button"
      tabIndex={0}
      aria-label={`Voice Agent Orb - Currently ${state}`}
    >
      {/* 1. Deep Atmospheric Ambient Radial Glow */}
      <div
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          state === 'listening'
            ? 'bg-gradient-to-tr from-amber-500/50 via-orange-500/30 to-yellow-400/40'
            : state === 'speaking'
            ? 'bg-gradient-to-tr from-sky-400/50 via-teal-400/30 to-blue-600/40'
            : state === 'processing'
            ? 'bg-gradient-to-tr from-purple-500/50 via-fuchsia-500/40 to-amber-400/30 animate-pulse'
            : 'bg-white/10 hover:bg-amber-400/20'
        }`}
        style={{
          transform: `scale(${glowScale})`,
          opacity: state === 'idle' ? 0.4 : 0.85,
        }}
      />

      {/* 2. Outer Liquid Ripple Ring 1 (ChatGPT style) */}
      {(state === 'listening' || state === 'speaking') && (
        <div
          className={`absolute inset-0 rounded-full border transition-all duration-150 pointer-events-none ${
            state === 'listening'
              ? 'border-amber-400/30 bg-amber-400/5'
              : 'border-sky-400/30 bg-sky-400/5'
          }`}
          style={{
            transform: `scale(${ringScale2})`,
          }}
        />
      )}

      {/* 3. Outer Liquid Ripple Ring 2 */}
      {(state === 'listening' || state === 'speaking') && (
        <div
          className={`absolute inset-0 rounded-full border-2 transition-all duration-100 pointer-events-none ${
            state === 'listening'
              ? 'border-amber-300/40'
              : 'border-cyan-300/40'
          }`}
          style={{
            transform: `scale(${ringScale1})`,
          }}
        />
      )}

      {/* 4. Processing Hypnotic Orbit Ring */}
      {state === 'processing' && (
        <div className="absolute -inset-6 rounded-full border border-purple-400/40 animate-spin [animation-duration:3s] pointer-events-none">
          <div className="h-3 w-3 rounded-full bg-purple-300 blur-xs absolute top-0 left-1/2 -translate-x-1/2" />
        </div>
      )}

      {/* 5. Core Fluid Orb Sphere */}
      <div
        className={`relative z-10 w-4/5 h-4/5 rounded-full flex items-center justify-center shadow-2xl transition-all duration-150 backdrop-blur-md overflow-hidden ${
          state === 'listening'
            ? 'bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 shadow-[0_0_80px_rgba(245,158,11,0.65)] ring-2 ring-amber-200/60'
            : state === 'speaking'
            ? 'bg-gradient-to-br from-sky-200 via-teal-400 to-indigo-600 shadow-[0_0_80px_rgba(56,189,248,0.7)] ring-2 ring-cyan-200/60'
            : state === 'processing'
            ? 'bg-gradient-to-br from-purple-300 via-fuchsia-500 to-amber-500 shadow-[0_0_80px_rgba(168,85,247,0.6)] ring-2 ring-purple-200/50'
            : 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-[0_0_40px_rgba(255,255,255,0.06)] border border-white/20 hover:border-amber-400/60 hover:shadow-[0_0_50px_rgba(245,158,11,0.3)]'
        }`}
        style={{
          transform: `scale(${dynamicScale})`,
        }}
      >
        {/* Specular fluid light highlight */}
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-white/40 blur-md pointer-events-none" />

        {/* Center state visualizer */}
        <div className="flex items-center justify-center z-20">
          {state === 'listening' && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 bg-zinc-950/90 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(10, audioLevel * 50)}px` }}
              />
              <span
                className="w-2.5 bg-zinc-950/90 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(16, audioLevel * 72)}px` }}
              />
              <span
                className="w-2 bg-zinc-950/90 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(12, audioLevel * 58)}px` }}
              />
            </div>
          )}

          {state === 'speaking' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-8 bg-zinc-950/90 rounded-full animate-pulse" />
              <span className="w-2.5 h-14 bg-zinc-950/90 rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-10 bg-zinc-950/90 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          )}

          {state === 'processing' && (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-zinc-950/90 animate-bounce" />
              <span className="h-3 w-3 rounded-full bg-zinc-950/90 animate-bounce [animation-delay:150ms]" />
              <span className="h-3 w-3 rounded-full bg-zinc-950/90 animate-bounce [animation-delay:300ms]" />
            </div>
          )}

          {state === 'idle' && (
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.9)] mb-2 animate-pulse" />
              <span className="text-xs font-bold text-zinc-200 tracking-wider uppercase">
                Tap to Speak
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
