'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Sparkles,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  Lightbulb,
  Compass,
  ListTodo,
  Flame,
  RotateCw,
  AlertCircle,
  Download,
  HelpCircle,
  SlidersHorizontal,
  ChevronDown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Square,
  AudioLines,
  ArrowUp,
  MapPin,
  Bell,
  ExternalLink,
  ShieldAlert,
  SendHorizontal,
  Loader2
} from 'lucide-react';
import { JournalEntry, Turn, ReflectionMode, EntryInsight, EntryLocation, EntryPriority, NotificationDispatchStatus } from '@/lib/types';
import { LocationPicker } from './LocationPicker';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/api-client';
import { useApiKey } from '@/lib/api-key';

interface EntryEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
  onSendPrompt: (prompt: string, mode: ReflectionMode) => Promise<void>;
  onSummarize: () => Promise<void>;
  isGenerating: boolean;
  isSummarizing: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  onExport: () => void;
  onOpenWeeklyDigest?: () => void;
  userEmail?: string;
  userName?: string;
}

const MODES: { id: ReflectionMode; label: string; description: string; icon: any }[] = [
  {
    id: 'deep_reflection',
    label: 'Deep Reflection',
    description: 'Empathetic synthesis, emotional clarity, and growth',
    icon: Sparkles,
  },
  {
    id: 'socratic_coach',
    label: 'Socratic Inquiry',
    description: 'Clarifying questions challenging assumptions',
    icon: HelpCircle,
  },
  {
    id: 'brainstorming',
    label: 'Creative Brainstorm',
    description: 'Lateral thinking, diverse perspectives, and analogies',
    icon: Lightbulb,
  },
  {
    id: 'action_planning',
    label: 'Action Planning',
    description: 'Concrete micro-habits and pragmatic next steps',
    icon: ListTodo,
  },
  {
    id: 'gratitude_mindfulness',
    label: 'Gratitude & Calm',
    description: 'Anchoring in presence, small wins, and self-compassion',
    icon: Compass,
  },
];

const PROMPT_SPARKS = [
  'What decision or situation consumed most of my mental bandwidth today?',
  'What is an unexamined assumption I might be making about this problem?',
  'How would my wisest, future self advise me on this crossroads?',
  'What is one small win or moment of genuine connection I experienced?',
  'If I were completely unconcerned with failure, what step would I take next?',
];

export function EntryEditor({
  entry,
  onUpdateEntry,
  onSendPrompt,
  onSummarize,
  isGenerating,
  isSummarizing,
  saveStatus,
  onExport,
  onOpenWeeklyDigest,
  userEmail,
  userName,
}: EntryEditorProps) {
  const { language, t } = useLanguage();
  const { providerDefinition } = useApiKey();
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>('deep_reflection');
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  // Location Modal State
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Notification Trigger State
  const [isDispatchingNotification, setIsDispatchingNotification] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);

  // Voice & Dictation state
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTime, setDictationTime] = useState(0);
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRecRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dictationBaseTextRef = useRef<string>('');
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const dictationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop playing speech audio
  const stopPlayingAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingTurnId(null);
  }, []);

  // Stop voice dictation
  const stopDictation = useCallback(() => {
    setIsDictating(false);
    if (dictationTimerRef.current) {
      clearInterval(dictationTimerRef.current);
      dictationTimerRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {}
      speechRecRef.current = null;
    }
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      try {
        mediaRecRef.current.stop();
        mediaRecRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaRecRef.current = null;
    }
  }, []);

  // Auto-scroll when new turn arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.turns, isGenerating]);

  // Clean up audio & dictation on unmount
  useEffect(() => {
    return () => {
      stopDictation();
      stopPlayingAudio();
    };
  }, [stopDictation, stopPlayingAudio]);

  const handlePlayTurnAudio = async (text: string, turnId: string) => {
    if (playingTurnId === turnId) {
      stopPlayingAudio();
      return;
    }

    stopPlayingAudio();
    setPlayingTurnId(turnId);

    try {
      const res = await apiFetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'Kore',
        }),
      }, { includeAiProvider: true });

      if (res.ok) {
        const data = await res.json();
        if (data.audio && !data.fallback) {
          const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setPlayingTurnId(null);
          };
          audio.onerror = () => {
            playFallbackSpeech(text, turnId);
          };
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('TTS request error, using Web Speech fallback:', e);
    }

    playFallbackSpeech(text, turnId);
  };

  const playFallbackSpeech = (text: string, turnId: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPlayingTurnId(null);
      return;
    }

    const cleanText = text.replace(/[#*_`~>[\]]/g, '').slice(0, 800);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langTag = language === 'vi' ? 'vi-VN' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US';
    utterance.lang = langTag;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith(language) ||
          v.name.includes(language.toUpperCase()) ||
          v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.lang === langTag
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.onend = () => setPlayingTurnId(null);
    utterance.onerror = () => setPlayingTurnId(null);
    window.speechSynthesis.speak(utterance);
  };

  const startDictation = async () => {
    stopPlayingAudio();
    setIsDictating(true);
    setDictationTime(0);
    audioChunksRef.current = [];
    dictationBaseTextRef.current = inputPrompt.trim();

    dictationTimerRef.current = setInterval(() => {
      setDictationTime((prev) => prev + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(250);

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'vi' ? 'vi-VN' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US';

        recognition.onresult = (event: any) => {
          let sessionTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            sessionTranscript += event.results[i][0].transcript;
          }
          if (sessionTranscript) {
            const base = dictationBaseTextRef.current;
            const combined = base ? `${base} ${sessionTranscript.trim()}` : sessionTranscript.trim();
            setInputPrompt(combined);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Dictation speech recognition error:', e);
        };

        recognition.start();
        speechRecRef.current = recognition;
      }
    } catch (err) {
      console.error('Dictation mic error:', err);
      stopDictation();
      alert('Microphone access is needed for voice dictation.');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isDictating) {
      stopDictation();
    }
    const promptToSend = inputPrompt.trim();
    if (!promptToSend || isGenerating) return;

    setInputPrompt('');
    await onSendPrompt(promptToSend, selectedMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyText = async (text: string, turnId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  const toggleActionItem = (index: number) => {
    setCheckedActions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Location handler
  const handleLocationChange = (loc?: EntryLocation) => {
    onUpdateEntry({
      ...entry,
      location: loc,
    });
  };

  // Priority change & auto-notification trigger
  const handlePriorityChange = async (priority: EntryPriority) => {
    const updated: JournalEntry = {
      ...entry,
      priority,
    };
    await onUpdateEntry(updated);

    if (priority === 'urgent' || priority === 'crisis') {
      dispatchNotification(updated, false);
    }
  };

  // External notification dispatcher
  const dispatchNotification = async (targetEntry: JournalEntry, isManualTest = false) => {
    setIsDispatchingNotification(true);
    setNotificationFeedback(null);

    try {
      const res = await apiFetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: targetEntry.id,
          title: targetEntry.title,
          priority: targetEntry.priority || 'urgent',
          mood: targetEntry.mood,
          userEmail: userEmail || 'user@reflection.app',
          userName: userName || 'Journal Author',
          location: targetEntry.location,
          summary: targetEntry.summary,
          keyInsights: targetEntry.keyInsights,
          actionItems: targetEntry.actionItems,
          forceTest: isManualTest,
        }),
      });

      const data = await res.json();
      if (res.ok && data.dispatched) {
        const dispatchStatus: NotificationDispatchStatus = {
          dispatched: true,
          timestamp: data.timestamp || new Date().toISOString(),
          channels: data.channels || ['slack', 'discord'],
          triggerReason: data.triggerReason || `Priority: ${targetEntry.priority}`,
          status: data.status || 'delivered',
          details: data.details || undefined,
        };

        await onUpdateEntry({
          ...targetEntry,
          notificationStatus: dispatchStatus,
        });

        setNotificationFeedback(`Dispatched to ${dispatchStatus.channels.join(', ').toUpperCase()}`);
        setTimeout(() => setNotificationFeedback(null), 5000);
      } else {
        setNotificationFeedback(data.message || 'Notification skipped');
        setTimeout(() => setNotificationFeedback(null), 4000);
      }
    } catch (err: any) {
      console.error('Notification dispatch error:', err);
      setNotificationFeedback('Alert trigger failed');
      setTimeout(() => setNotificationFeedback(null), 4000);
    } finally {
      setIsDispatchingNotification(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950/30">

      {/* Session Header */}
      <div className="border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          {/* Editable Title and Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input
                id="input-entry-title"
                type="text"
                value={entry.title}
                onChange={(e) =>
                  onUpdateEntry({ ...entry, title: e.target.value })
                }
                placeholder="Name this reflection session..."
                className="w-full truncate text-base font-bold text-white placeholder:text-zinc-600 focus:outline-none sm:text-lg bg-transparent"
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {/* Category dropdown */}
              <select
                id="select-entry-category"
                value={entry.category}
                onChange={(e) =>
                  onUpdateEntry({ ...entry, category: e.target.value })
                }
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-200 focus:border-amber-400/60 focus:outline-none"
              >
                <option value="Daily Reflection" className="bg-zinc-900 text-white">Daily Reflection</option>
                <option value="Brainstorming" className="bg-zinc-900 text-white">Brainstorming</option>
                <option value="Mindfulness" className="bg-zinc-900 text-white">Mindfulness</option>
                <option value="Decision Making" className="bg-zinc-900 text-white">Decision Making</option>
                <option value="Personal Growth" className="bg-zinc-900 text-white">Personal Growth</option>
                <option value="Career & Focus" className="bg-zinc-900 text-white">Career & Focus</option>
              </select>

              {/* Priority Selector */}
              <select
                id="select-entry-priority"
                value={entry.priority || 'normal'}
                onChange={(e) => handlePriorityChange(e.target.value as EntryPriority)}
                className={`rounded border px-2 py-0.5 text-xs font-semibold focus:outline-none transition ${
                  entry.priority === 'urgent' || entry.priority === 'crisis'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                    : entry.priority === 'important' || entry.priority === 'milestone'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-white/10 bg-white/5 text-zinc-300'
                }`}
              >
                <option value="normal" className="bg-zinc-900 text-zinc-300">Priority: Normal</option>
                <option value="important" className="bg-zinc-900 text-amber-300">Priority: Important</option>
                <option value="milestone" className="bg-zinc-900 text-amber-400">Priority: Milestone 🌟</option>
                <option value="urgent" className="bg-zinc-900 text-rose-400">Priority: Urgent 🚨</option>
                <option value="crisis" className="bg-zinc-900 text-rose-500">Priority: Crisis ⚠️</option>
              </select>

              {/* Location Pin Trigger Button & Badge */}
              <button
                id="btn-open-location-picker"
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition ${
                  entry.location
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 font-medium'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                }`}
                title="Pin or edit location"
              >
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span className="max-w-[130px] truncate">
                  {entry.location?.name || 'Pin Location'}
                </span>
              </button>

              {/* External Notification Dispatch Status */}
              {entry.notificationStatus?.dispatched && (
                <span
                  id="badge-notification-dispatched"
                  className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300"
                  title={`Dispatched at ${entry.notificationStatus.timestamp}`}
                >
                  <Bell className="h-3 w-3 text-sky-400" />
                  <span>Slack/Discord Sent</span>
                </span>
              )}

              {/* Manual Dispatch feedback */}
              {notificationFeedback && (
                <span className="text-[11px] text-emerald-400 animate-pulse font-medium">
                  {notificationFeedback}
                </span>
              )}

              {entry.mood && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  <span>Mood: {entry.mood}</span>
                </span>
              )}

              <span>•</span>
              <span className="text-zinc-500">
                Started {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Action buttons & Save status */}
          <div className="flex items-center gap-2 self-end sm:self-center">

            {/* Real-time Save status badge */}
            <div
              id="save-status-indicator"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300"
            >
              {saveStatus === 'saving' && (
                <>
                  <div className="h-2 w-2 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                  <span>Syncing...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-zinc-300">Saved to Firestore</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                  <button
                    onClick={() => onUpdateEntry(entry)}
                    className="text-rose-300 underline font-semibold"
                  >
                    Retry Save
                  </button>
                </>
              )}
            </div>

            {/* Distill & Summarize button */}
            <button
              id="btn-distill-summary"
              onClick={onSummarize}
              disabled={isSummarizing || entry.turns.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-xs hover:bg-amber-400/20 disabled:opacity-50 transition"
              title="Generate Executive Summary, Key Insights & Action Items"
            >
              {isSummarizing ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-amber-300 border-t-transparent" />
              ) : (
                <BrainCircuit className="h-3.5 w-3.5 text-amber-300" />
              )}
              <span>{entry.summary ? 'Update AI Insights' : 'Distill Insights'}</span>
            </button>

            {/* Weekly AI Digest Trigger */}
            {onOpenWeeklyDigest && (
              <button
                id="btn-entry-weekly-digest"
                onClick={onOpenWeeklyDigest}
                title="Weekly AI Reflection Digest & Goal Follow-Up (Email/Discord/Slack)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-amber-600/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:from-amber-500/25 hover:to-amber-600/25 transition shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Weekly Digest</span>
              </button>
            )}

            {/* Export entry */}
            <button
              id="btn-entry-export"
              onClick={onExport}
              title="Export Reflection"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            >
              <Download className="h-4 w-4" />
            </button>

          </div>

        </div>
      </div>

      {/* Main Scrollable Conversation & Insights Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* iOS-Grade Pinned Location & Atmosphere Capsule */}
        {entry.location && (
          <div
            id="pinned-location-banner"
            className="group relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-[#10131c] to-[#0c0e14] p-3.5 shadow-md shadow-amber-950/20 backdrop-blur-xl transition hover:border-amber-400/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-300 shadow-inner">
                  <MapPin className="h-5 w-5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400/80">
                      Geographic Anchor
                    </span>
                    {entry.location.ambientVibe && (
                      <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.2 text-[10px] font-medium text-amber-300 truncate">
                        ✨ {entry.location.ambientVibe}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {entry.location.name}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {entry.location.formattedAddress || entry.location.address || 'Coordinates pinned'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {entry.location.mapsUrl && (
                  <a
                    href={entry.location.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition"
                    title="Open in Google Maps"
                  >
                    <span>Maps</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  id="btn-edit-pinned-location"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 transition"
                >
                  Adjust Pin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Distilled AI Insights Card (if generated) */}
        {entry.summary && (
          <div
            id="distilled-insights-panel"
            className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/30 via-zinc-900/70 to-amber-900/20 p-5 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-zinc-950 font-bold">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-amber-200">
                  AI Distilled Insights & Synthesis
                </h3>
              </div>
              {entry.mood && (
                <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                  Detected Mood: {entry.mood}
                </span>
              )}
            </div>

            {/* Executive summary */}
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
                Executive Summary
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                {entry.summary}
              </p>
            </div>

            {/* Key Insights & Action Items columns */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Key Insights */}
              {entry.keyInsights && entry.keyInsights.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Key Realizations & Themes
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {entry.keyInsights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action items */}
              {entry.actionItems && entry.actionItems.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-md">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                    <ListTodo className="h-3.5 w-3.5 text-emerald-400" />
                    Actionable Next Steps
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {entry.actionItems.map((action, idx) => {
                      const isDone = !!checkedActions[idx];
                      return (
                        <li
                          key={idx}
                          onClick={() => toggleActionItem(idx)}
                          className={`flex items-start gap-2 cursor-pointer transition select-none ${
                            isDone ? 'line-through text-zinc-500' : ''
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5 hover:text-zinc-300" />
                          )}
                          <span>{action}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Empty state / Introduction */}
        {entry.turns.length === 0 && (
          <div className="mx-auto max-w-xl text-center py-8 px-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Begin Your Reflection Dialogue
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Write down your raw thoughts, a dilemma, or today&apos;s observations. Your AI provider will reflect back thoughtful perspectives, challenge assumptions, and help you distill clarity.
            </p>

            <div className="mx-auto mt-6 max-w-sm text-left">
              <div
                onClick={startDictation}
                className="cursor-pointer group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-zinc-950 p-4 transition-all hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-white font-bold group-hover:scale-105 transition-transform">
                    <Mic className="h-5 w-5 text-amber-300" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    Speech to Text
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors">
                  Voice Dictation (Transcribe)
                </h4>
                <p className="mt-1 text-[11px] text-zinc-400 leading-normal">
                  Speak instead of typing. Your spoken words are transcribed directly into the reflection box.
                </p>
              </div>
            </div>

            {/* Prompt sparks */}
            <div className="mt-6 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Need a spark to start?
              </p>
              <div className="space-y-1.5">
                {PROMPT_SPARKS.map((spark, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputPrompt(spark)}
                    className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] transition"
                  >
                    &ldquo;{spark}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Turns */}
        {entry.turns.map((turn, index) => {
          const isUser = turn.role === 'user';
          return (
            <div
              key={turn.id || index}
              id={`chat-turn-${index}`}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Assistant avatar */}
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/30 to-white/10 border border-white/15 text-amber-300 shadow-xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`group relative max-w-2xl rounded-2xl px-4 py-3.5 text-xs sm:text-sm shadow-sm ${
                  isUser
                    ? 'bg-amber-400 text-zinc-950 font-medium rounded-br-xs'
                    : 'bg-white/[0.04] text-zinc-200 border border-white/10 rounded-bl-xs backdrop-blur-md'
                }`}
              >
                {/* Header for assistant message */}
                {!isUser && (
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-200">{providerDefinition.name}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono">
                        AI response
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* TTS Speak Aloud Button */}
                      <button
                        id={`btn-play-turn-${turn.id || index}`}
                        onClick={() => handlePlayTurnAudio(turn.content, turn.id)}
                        className={`rounded p-1 transition ${
                          playingTurnId === turn.id
                            ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={playingTurnId === turn.id ? 'Stop voice playback' : 'Read response aloud'}
                      >
                        {playingTurnId === turn.id ? (
                          <div className="flex items-center gap-1">
                            <Square className="h-3 w-3 text-sky-400 fill-sky-400" />
                            <span className="text-[9px] text-sky-300 font-medium">Playing</span>
                          </div>
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                      </button>

                      <button
                        onClick={() => handleCopyText(turn.content, turn.id)}
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-400 hover:text-white transition"
                        title="Copy response"
                      >
                        {copiedTurnId === turn.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Content */}
                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {turn.content}
                  </p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none text-xs sm:text-sm leading-relaxed text-zinc-200">
                    <ReactMarkdown>{turn.content}</ReactMarkdown>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`mt-2 text-[10px] ${
                    isUser ? 'text-zinc-800 text-right' : 'text-zinc-500 text-left'
                  }`}
                >
                  {new Date(turn.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-zinc-200">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading indicator when Gemini is generating */}
        {isGenerating && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-amber-300">
              <Bot className="h-4 w-4 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-white/10 bg-white/[0.04] px-4 py-3 shadow-xs backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <span>{providerDefinition.name} is reflecting on your entry...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Area - ChatGPT Authentic Layout */}
      <div className="border-t border-white/10 bg-[#050508]/90 backdrop-blur-2xl p-4">

        {/* Mode Selector Pill Bar */}
        <div className="mb-2.5 flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 mr-0.5 flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" /> Mode:
            </span>
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  title={mode.description}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    isSelected
                      ? 'border border-amber-400/40 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30 font-semibold'
                      : 'border border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`h-3 w-3 ${isSelected ? 'text-amber-300' : 'text-zinc-400'}`} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

        </div>

        {/* ChatGPT Style Floating Input Capsule */}
        <form
          onSubmit={handleSend}
          className={`relative rounded-2xl border bg-zinc-900/90 shadow-xl backdrop-blur-xl transition-all ${
            isDictating
              ? 'border-amber-400/70 ring-1 ring-amber-400/40 bg-amber-950/10'
              : 'border-white/15 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/40'
          }`}
        >
          <textarea
            ref={textareaRef}
            id="input-reflection-prompt"
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDictating
                ? 'Listening to your voice... Speak your thoughts clearly...'
                : `Message ${providerDefinition.name} in ${MODES.find((m) => m.id === selectedMode)?.label} mode... (or tap mic to dictate)`
            }
            className="w-full resize-none bg-transparent p-3.5 pb-10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none scrollbar-none"
          />

          {/* Active Dictation Live Recording Bar */}
          {isDictating && (
            <div className="absolute left-3.5 bottom-2.5 flex items-center gap-2 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>Transcribing Speech ({dictationTime}s)...</span>
            </div>
          )}

          {/* Bottom Right Action Controls */}
          <div className="absolute right-2.5 bottom-2 flex items-center gap-1.5">

            {/* Location Quick Pin in Composer */}
            <button
              id="btn-composer-pin-location"
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                entry.location
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
              title={entry.location ? `Pinned: ${entry.location.name}` : 'Pin Location'}
            >
              <MapPin className="h-4 w-4" />
            </button>

            {/* 1. Dictation Microphone Button (Speech to Text) */}
            <button
              id="btn-composer-dictate"
              type="button"
              onClick={isDictating ? stopDictation : startDictation}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                isDictating
                  ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
              title={isDictating ? 'Stop Voice Dictation' : 'Dictate with Voice (Speech to Text)'}
            >
              {isDictating ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              id="btn-send-reflection"
              type="submit"
              disabled={isGenerating || !inputPrompt.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-950 shadow-md hover:bg-zinc-200 disabled:opacity-40 transition-all hover:scale-105"
              title="Send Reflection"
            >
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            </button>

          </div>
        </form>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Mic className="h-3 w-3 text-zinc-400" />
              <span>Mic = Speech to Text</span>
            </span>
          </div>
          <span>Shift + Enter for new lines</span>
        </div>

      </div>

      {/* Location Picker Modal */}
      <LocationPicker
        isOpen={isLocationModalOpen}
        location={entry.location}
        onChange={handleLocationChange}
        onClose={() => setIsLocationModalOpen(false)}
      />

    </div>
  );
}
