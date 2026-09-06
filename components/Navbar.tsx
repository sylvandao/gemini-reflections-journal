'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User } from 'firebase/auth';
import {
  Sparkles,
  LogOut,
  PlusCircle,
  BookOpen,
  ShieldCheck,
  User as UserIcon,
  Flame,
  Radio,
  Mic,
  Headphones,
  AudioLines,
  ShieldAlert,
  Globe,
  Navigation,
  Check,
  ChevronDown,
  Compass,
  Loader2,
  Key
} from 'lucide-react';
import { getUserProfile, BOOTSTRAP_ADMIN_EMAIL } from '@/lib/firebase';
import { UserProfile, SupportedLanguage } from '@/lib/types';
import { useLanguage, LANGUAGE_OPTIONS } from '@/lib/i18n';

interface NavbarProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewEntry: () => void;
  onOpenVoiceAgent?: () => void;
  onOpenWeeklyDigest?: () => void;
  onOpenApiKey?: () => void;
  hasApiKey?: boolean;
  entriesCount: number;
  activeView: 'editor' | 'history' | 'providers';
  setActiveView: (view: 'editor' | 'history' | 'providers') => void;
}

export function Navbar({
  user,
  onSignIn,
  onSignOut,
  onNewEntry,
  onOpenVoiceAgent,
  onOpenWeeklyDigest,
  onOpenApiKey,
  hasApiKey = false,
  entriesCount,
  activeView,
  setActiveView,
}: NavbarProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    language,
    setLanguage,
    isAutoGpsEnabled,
    setIsAutoGpsEnabled,
    detectAndApplyGpsLanguage,
    t,
    lastDetectedRegion
  } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      return;
    }
    getUserProfile(user.uid).then((prof) => {
      if (isMounted) setProfile(prof);
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeProfile = user ? profile : null;
  const isAdmin = user && (
    user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ||
    activeProfile?.role === 'admin'
  );

  const currentLangObj = LANGUAGE_OPTIONS.find(l => l.code === language) || LANGUAGE_OPTIONS[0];

  const handleGpsToggle = async () => {
    if (!isAutoGpsEnabled) {
      setIsDetectingGps(true);
      const res = await detectAndApplyGpsLanguage();
      setIsDetectingGps(false);
      if (res) {
        setLangDropdownOpen(false);
      }
    } else {
      setIsAutoGpsEnabled(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050508]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">

        {/* Brand identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            id="brand-logo-container"
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 via-white/10 to-amber-400/30 border border-white/15 text-amber-300 shadow-inner shrink-0"
          >
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-semibold tracking-tight text-white">
                {t('app.name')}
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium tracking-wide text-amber-300">
                Multi-provider BYOK
              </span>
            </div>
            <p className="hidden text-[11px] text-zinc-400 md:block">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">

          {/* Language Switcher & Auto GPS Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="btn-nav-language-select"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 hover:border-amber-400/40 hover:text-white transition shadow-xs"
              title="Change Language or Enable GPS Auto-Switch"
              aria-label="Language options"
            >
              <span className="text-sm">{currentLangObj.flag}</span>
              <span className="hidden sm:inline font-medium text-zinc-100">{currentLangObj.code.toUpperCase()}</span>
              {isAutoGpsEnabled && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/30" title="GPS Auto-Detect Active">
                  <Navigation className="h-2.5 w-2.5 fill-emerald-400" />
                </span>
              )}
              <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {langDropdownOpen && (
              <div
                id="language-dropdown-menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>{t('nav.language')}</span>
                  {isAutoGpsEnabled && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      GPS Active
                    </span>
                  )}
                </div>

                <div className="space-y-1 my-1">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const isSelected = opt.code === language;
                    return (
                      <button
                        key={opt.code}
                        id={`btn-lang-${opt.code}`}
                        onClick={() => {
                          setLanguage(opt.code);
                          setIsAutoGpsEnabled(false);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                          isSelected
                            ? 'bg-amber-400/15 text-amber-300 font-semibold border border-amber-400/30'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{opt.flag}</span>
                          <div className="text-left">
                            <p className="font-medium leading-tight">{opt.nativeLabel}</p>
                            <p className="text-[10px] text-zinc-400 leading-tight">{opt.country}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-white/10 pt-2 mt-1.5">
                  <button
                    id="btn-toggle-auto-gps"
                    onClick={handleGpsToggle}
                    disabled={isDetectingGps}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                      isAutoGpsEnabled
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isDetectingGps ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Navigation className={`h-3.5 w-3.5 ${isAutoGpsEnabled ? 'text-emerald-400 fill-emerald-400' : 'text-zinc-400'}`} />
                      )}
                      <div className="text-left">
                        <p className="font-semibold">{t('nav.auto_gps')}</p>
                        <p className="text-[10px] text-zinc-400">
                          {lastDetectedRegion ? `GPS: ${lastDetectedRegion}` : 'Detect VN 🇻🇳, CN 🇨🇳, KR 🇰🇷, US 🇺🇸'}
                        </p>
                      </div>
                    </div>
                    <div className={`h-4 w-7 rounded-full p-0.5 transition-colors ${isAutoGpsEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                      <div className={`h-3 w-3 rounded-full bg-white transition-transform ${isAutoGpsEnabled ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {onOpenApiKey && (
            <button
              id="btn-nav-api-key"
              onClick={onOpenApiKey}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                hasApiKey
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                  : 'border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
              }`}
              title={hasApiKey ? 'AI provider connected for this tab only' : 'Open AI Providers — keys are never stored'}
            >
              <Key className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{hasApiKey ? 'AI connected' : 'AI Providers'}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            </button>
          )}

          {user ? (
            <>
              {/* Admin Console Link (Shown only to verified admins) */}
              {isAdmin && (
                <Link
                  id="btn-nav-admin-console"
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 transition"
                  title="Access Restricted Admin Console"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden md:inline">{t('nav.admin_area')}</span>
                </Link>
              )}

              {/* Live Voice Mode Header Trigger */}
              {onOpenVoiceAgent && (
                <button
                  id="btn-nav-live-voice-agent"
                  onClick={onOpenVoiceAgent}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/20 via-amber-400/10 to-amber-500/20 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition hover:border-amber-400 hover:bg-amber-400/30 hover:text-white"
                  title="Launch ChatGPT-style Real-Time Voice Agent"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <Headphones className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{t('nav.voice_agent')}</span>
                </button>
              )}

              {/* Weekly Digest Trigger */}
              {onOpenWeeklyDigest && (
                <button
                  id="btn-nav-weekly-digest"
                  onClick={onOpenWeeklyDigest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition"
                  title="Open Weekly AI Digest & Growth Loop"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden lg:inline">{t('nav.weekly_digest')}</span>
                </button>
              )}

              <button
                id="btn-nav-new-entry"
                onClick={onNewEntry}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                <PlusCircle className="h-3.5 w-3.5 text-amber-600" />
                <span className="hidden sm:inline">{t('nav.new_entry')}</span>
              </button>

              <button
                id="btn-nav-toggle-view"
                onClick={() => setActiveView(activeView === 'editor' ? 'history' : 'editor')}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium transition ${
                  activeView === 'history'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 shadow-xs'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden md:inline">{t('nav.history')}</span>
                <span className="inline-flex h-4 sm:h-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] sm:text-[11px] font-semibold text-zinc-200">
                  {entriesCount}
                </span>
              </button>

              {/* User profile dropdown / chip */}
              <div
                id="user-profile-badge"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] py-1 pl-1 pr-1.5 sm:pl-1.5 sm:pr-2 shadow-xs backdrop-blur-md"
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User profile'}
                    width={26}
                    height={26}
                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-full object-cover ring-1 ring-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/10 text-zinc-300">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="hidden max-w-[100px] text-left xl:block">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {user.displayName || 'Journalist'}
                  </p>
                </div>
                <button
                  id="btn-nav-sign-out"
                  onClick={onSignOut}
                  title={t('nav.sign_out')}
                  className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              id="btn-nav-sign-in"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
              <span>{t('nav.sign_in')}</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
