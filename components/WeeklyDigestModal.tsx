'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Mail,
  Send,
  Check,
  Copy,
  Calendar,
  Flame,
  Target,
  TrendingUp,
  HelpCircle,
  X,
  MessageSquare,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { JournalEntry, WeeklyDigestConfig, WeeklyDigestResult } from '@/lib/types';
import { getUserDigestSettings, saveUserDigestSettings } from '@/lib/firebase';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/api-client';

interface WeeklyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  userId: string;
  userName?: string;
  userEmail?: string;
}

export function WeeklyDigestModal({
  isOpen,
  onClose,
  entries,
  userId,
  userName = 'Journal Author',
  userEmail = '',
}: WeeklyDigestModalProps) {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'preview' | 'channels'>('preview');
  const [isLoading, setIsLoading] = useState(false);
  const [digestResult, setDigestResult] = useState<WeeklyDigestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Settings State
  const [config, setConfig] = useState<WeeklyDigestConfig>({
    enabled: true,
    deliveryDay: 'sunday',
    channels: {
      email: true,
      discord: false,
      slack: false,
      appOnly: false,
    },
    destinationEmail: userEmail,
    discordWebhookUrl: '',
    slackWebhookUrl: '',
    gmailAppsScriptUrl: '',
  });

  // Load saved preferences
  useEffect(() => {
    if (userId && isOpen) {
      getUserDigestSettings(userId).then((saved) => {
        if (saved) {
          setConfig((prev) => ({
            ...prev,
            ...saved,
            destinationEmail: saved.destinationEmail || userEmail || prev.destinationEmail,
          }));
        }
      });
    }
  }, [userId, isOpen, userEmail]);

  // Generate or regenerate digest
  const handleGenerateDigest = async () => {
    if (!entries || entries.length === 0) {
      setError('Please write at least one journal reflection before generating your weekly digest.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/notifications/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail: config.destinationEmail || userEmail,
          userName,
          entries: entries.slice(0, 15),
          config,
          language,
        }),
      }, { includeAiProvider: true });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to synthesize weekly digest');
      }

      setDigestResult(data.digest);
    } catch (err: any) {
      console.error('Digest generation failed:', err);
      setError(err?.message || 'Could not generate weekly digest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save Channel Configurations
  const handleSaveSettings = async () => {
    if (!userId) return;
    setIsSavingSettings(true);
    setSaveFeedback(null);
    try {
      await saveUserDigestSettings(userId, {
        enabled: config.enabled,
        deliveryDay: config.deliveryDay,
        channels: config.channels,
        destinationEmail: userEmail,
      });
      setSaveFeedback('Settings saved successfully!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveFeedback('Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const copyDigestMarkdown = () => {
    if (!digestResult) return;
    const text = `# ✨ Weekly AI Reflection Digest: ${digestResult.coreTheme}
**Author:** ${digestResult.userName} | **Period:** ${digestResult.weekRange}

## 📖 Executive Summary
${digestResult.executiveSummary}

## 💡 Key Mindset Breakthroughs
${digestResult.keyBreakthroughs.map((b) => `- ${b}`).join('\n')}

## 🎯 Goal Follow-Ups
${digestResult.goalFollowUps.map((g) => `- **${g.goal}**: ${g.followUpNote}`).join('\n')}

## 🌱 Prompt for Next Week
*"${digestResult.reflectionQuestionForNextWeek}"*`;

    navigator.clipboard.writeText(text);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-amber-500/30 bg-[#0f121a] text-zinc-100 shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-gradient-to-r from-amber-500/10 via-[#131722] to-[#0f121a]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 shadow-inner">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Weekly AI Digest & Habit Loop</h2>
                <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                  Re-Engagement
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Weekly AI synthesis and gentle goal check-ins delivered via Email, Discord, or Slack
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#0c0e14] px-6">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition ${
              activeTab === 'preview'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Weekly Synthesis & Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold transition ${
              activeTab === 'channels'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Notification Channels & Delivery</span>
          </button>

        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: Preview & Generator */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-300">Habit Retention Engine</div>
                  <div className="text-sm font-bold text-white">
                    {entries.length} reflections recorded in your journal
                  </div>
                  <div className="text-xs text-zinc-400">
                    Gemini analyzes all entries from the past 7 days, checks on your Monday goals, and creates an inspiring reflection arc.
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-generate-weekly-digest"
                    onClick={handleGenerateDigest}
                    disabled={isLoading || entries.length === 0}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Synthesizing your week...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>{digestResult ? 'Re-Generate & Dispatch Digest' : 'Generate & Send Weekly Digest'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {digestResult ? (
                <div className="space-y-4 rounded-xl border border-amber-500/30 bg-[#121622] p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                        {digestResult.weekRange}
                      </div>
                      <h3 className="text-lg font-extrabold text-white">{digestResult.coreTheme}</h3>
                    </div>
                    <button
                      onClick={copyDigestMarkdown}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    >
                      {copiedDigest ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedDigest ? 'Copied' : 'Copy Text'}</span>
                    </button>
                  </div>

                  {/* Executive Arc */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">Executive Growth Arc</h4>
                    <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-line bg-black/20 p-3.5 rounded-xl border border-white/5">
                      {digestResult.executiveSummary}
                    </p>
                  </div>

                  {/* Breakthroughs */}
                  {digestResult.keyBreakthroughs?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                        💡 Key Mindset Breakthroughs
                      </h4>
                      <div className="space-y-2">
                        {digestResult.keyBreakthroughs.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-zinc-200 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Goal Follow-ups */}
                  {digestResult.goalFollowUps?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
                        🎯 Active Goals & Accountability Follow-Up
                      </h4>
                      <div className="space-y-2">
                        {digestResult.goalFollowUps.map((goal, idx) => (
                          <div key={idx} className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-1">
                            <div className="font-bold text-blue-300">📌 {goal.goal}</div>
                            <div className="text-zinc-300">{goal.followUpNote}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next week prompt */}
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
                    <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider mb-1">
                      🌱 Provocative Question for Next Week
                    </div>
                    <div className="text-sm font-semibold italic text-white">
                      &ldquo;{digestResult.reflectionQuestionForNextWeek}&rdquo;
                    </div>
                  </div>

                  {digestResult.dispatchedChannels && (
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-2 border-t border-white/5">
                      <span>Delivered via:</span>
                      {digestResult.dispatchedChannels.map((c) => (
                        <span key={c} className="rounded-md bg-white/10 px-2 py-0.5 font-bold uppercase text-zinc-200">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-white/10 text-center space-y-2">
                  <Calendar className="h-8 w-8 text-zinc-500" />
                  <div className="text-sm font-semibold text-zinc-300">No Weekly Digest Generated Yet</div>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Click the button above to synthesize your entries from the past 7 days into an inspiring progress summary and goal check-in.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Channels & Preferences */}
          {activeTab === 'channels' && (
            <div className="space-y-5">
              <div className="text-xs text-zinc-400">
                Choose where you want your automated weekly AI reflection digest delivered to help you maintain your daily journaling momentum.
              </div>

              {/* Delivery Day */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  Preferred Weekly Delivery Day
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sunday', 'monday', 'friday'] as const).map((day) => (
                    <button
                      key={day}
                      onClick={() => setConfig({ ...config, deliveryDay: day })}
                      className={`rounded-xl border py-2.5 text-xs font-bold capitalize transition ${
                        config.deliveryDay === day
                          ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                          : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {day} Evening
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels toggles */}
              <div className="space-y-3">
                {/* Email Channel */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Email Digest (Gmail / Apps Script)</div>
                        <div className="text-[11px] text-zinc-400">Delivers responsive HTML email with your weekly growth arc</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.channels.email}
                      onChange={(e) => setConfig({
                        ...config,
                        channels: { ...config.channels, email: e.target.checked }
                      })}
                      className="h-4 w-4 rounded accent-amber-500"
                    />
                  </div>

                  {config.channels.email && (
                    <p className="border-t border-white/5 pt-2 text-[11px] text-zinc-400">Delivery uses your verified sign-in email. Webhook credentials are configured only on the server.</p>
                  )}
                </div>

                {/* Discord Channel */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="h-4 w-4 text-indigo-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Discord Webhook</div>
                        <div className="text-[11px] text-zinc-400">Posts rich embed with goals & reflections into your personal server</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.channels.discord}
                      onChange={(e) => setConfig({
                        ...config,
                        channels: { ...config.channels, discord: e.target.checked }
                      })}
                      className="h-4 w-4 rounded accent-indigo-500"
                    />
                  </div>

                  {config.channels.discord && (
                    <p className="border-t border-white/5 pt-2 text-[11px] text-zinc-400">The Discord destination is managed through the Cloud Run secret configuration.</p>
                  )}
                </div>

                {/* Slack Channel */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Target className="h-4 w-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-bold text-white">Slack Webhook</div>
                        <div className="text-[11px] text-zinc-400">Dispatches executive recap blocks to your private workspace channel</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.channels.slack}
                      onChange={(e) => setConfig({
                        ...config,
                        channels: { ...config.channels, slack: e.target.checked }
                      })}
                      className="h-4 w-4 rounded accent-emerald-500"
                    />
                  </div>

                  {config.channels.slack && (
                    <p className="border-t border-white/5 pt-2 text-[11px] text-zinc-400">The Slack destination is managed through the Cloud Run secret configuration.</p>
                  )}
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center justify-between pt-2">
                {saveFeedback && (
                  <span className="text-xs font-semibold text-amber-300 animate-fade-in">{saveFeedback}</span>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3.5 bg-[#0c0e14] text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <span>Habit Consistency Loop</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
