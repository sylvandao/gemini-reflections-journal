'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeftRight,
  MessageSquare,
  User,
  Bot,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Square,
  Radio
} from 'lucide-react';
import { VoiceOrb, VoiceState } from './VoiceOrb';
import { Turn, ReflectionMode } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { apiFetch } from '@/lib/api-client';

interface VoiceAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryTitle: string;
  turns: Turn[];
  onSendTurn: (prompt: string, mode: ReflectionMode, assistantReply?: string) => Promise<string | null>;
  currentMode: ReflectionMode;
  onModeChange: (mode: ReflectionMode) => void;
}

const AVAILABLE_VOICES = [
  { id: 'Kore', label: 'Kore (Empathetic & Warm)' },
  { id: 'Puck', label: 'Puck (Engaging & Crisp)' },
  { id: 'Zephyr', label: 'Zephyr (Thoughtful & Soft)' },
  { id: 'Fenrir', label: 'Fenrir (Deep & Grounded)' },
  { id: 'Aoede', label: 'Aoede (Melodic & Gentle)' },
  { id: 'Charon', label: 'Charon (Wise & Reflective)' },
];

export function VoiceAgentModal({
  isOpen,
  onClose,
  entryTitle,
  turns,
  onSendTurn,
  currentMode,
  onModeChange,
}: VoiceAgentModalProps) {
  const { language, t } = useLanguage();
  const [state, setState] = useState<VoiceState>('idle');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isMuted, setIsMuted] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Tap the mic or orb to begin');
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);

  // Audio & media recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Stop / Cleanup all audio & streams
  const cleanupMedia = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setAudioLevel(0);
    isProcessingRef.current = false;
  }, []);

  // Stop on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  // Scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current && showTranscriptDrawer) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, liveTranscript, showTranscriptDrawer]);

  // Web Speech Fallback synthesis
  const playFallbackWebSpeech = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      finishSpokenResponse();
      return;
    }

    const clean = text.replace(/[#*_`~>[\]]/g, '').slice(0, 500);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const langTag = language === 'vi' ? 'vi-VN' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US';
    utterance.lang = langTag;

    // Attempt to pick matching natural voice for the target language
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

    // Simulate audio level pulses for orb
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 0.4 + 0.3);
    }, 120);

    utterance.onend = () => {
      clearInterval(interval);
      finishSpokenResponse();
    };
    utterance.onerror = () => {
      clearInterval(interval);
      finishSpokenResponse();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Called when assistant finishes speaking
  const finishSpokenResponse = () => {
    setAudioLevel(0);
    if (isHandsFree) {
      setState('listening');
      setStatusMessage('Listening to your thoughts...');
      startListening();
    } else {
      setState('idle');
      setStatusMessage('Tap the mic to respond');
    }
  };

  // Play audio response with Gemini WAV or fallback
  const playSpokenAudio = async (text: string, base64Wav: string | null) => {
    if (isMuted || !text) {
      finishSpokenResponse();
      return;
    }

    setState('speaking');
    setStatusMessage('Your AI is speaking...');

    if (base64Wav) {
      try {
        const audioUrl = `data:audio/wav;base64,${base64Wav}`;
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        // Connect to Web Audio Analyser to animate the VoiceOrb with real frequencies!
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioCtx.createMediaElementSource(audio);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyser.connect(audioCtx.destination);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const animateSpeech = () => {
            if (audio.paused || audio.ended) {
              setAudioLevel(0);
              return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length / 255;
            setAudioLevel(avg);
            animFrameRef.current = requestAnimationFrame(animateSpeech);
          };
          animateSpeech();
        } catch {
          // Fallback simple visual pulse if MediaElementSource is restricted
          const interval = setInterval(() => {
            if (audio.paused || audio.ended) {
              clearInterval(interval);
              setAudioLevel(0);
            } else {
              setAudioLevel(Math.random() * 0.5 + 0.25);
            }
          }, 100);
        }

        audio.onended = () => {
          finishSpokenResponse();
        };
        audio.onerror = (err) => {
          console.warn('Audio playback error, falling back to Web Speech:', err);
          playFallbackWebSpeech(text);
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn('Direct WAV playback failed, falling back to Web Speech:', err);
      }
    }

    // Web Speech API fallback
    playFallbackWebSpeech(text);
  };

  // High-Speed Voice Turn Pipeline
  const processVoiceTurn = async (spokenText: string) => {
    if (isProcessingRef.current || !spokenText.trim()) return;
    isProcessingRef.current = true;

    setState('processing');
    setStatusMessage('Your AI is reflecting...');
    setLiveTranscript('');

    // Stop mic stream while processing
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    try {
      // 1. Call high-speed voice conversation endpoint
      const res = await apiFetch('/api/gemini/voice-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: spokenText,
          history: turns,
          mode: currentMode,
          voice: selectedVoice,
          language,
        }),
      }, { includeAiProvider: true });

      if (!res.ok) {
        throw new Error('Voice conversation endpoint failed');
      }

      const data = await res.json();
      const replyText = data.reply || '';
      const base64Wav = data.audio || null;

      // 2. Persist turn to parent journal & Firestore without re-calling Gemini
      await onSendTurn(spokenText, currentMode, replyText);

      isProcessingRef.current = false;

      // 3. Play voice response
      if (replyText) {
        await playSpokenAudio(replyText, base64Wav);
      } else {
        finishSpokenResponse();
      }
    } catch (err: any) {
      console.error('Error processing voice turn:', err);
      isProcessingRef.current = false;
      setState('idle');
      setStatusMessage('Could not connect. Tap to try again.');
    }
  };

  // Stop recording manually
  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const textToProcess = liveTranscript.trim();
    if (textToProcess) {
      processVoiceTurn(textToProcess);
    } else {
      cleanupMedia();
      setState('idle');
      setStatusMessage('No speech detected. Tap mic to speak.');
    }
  };

  // Start recording
  const startListening = async () => {
    cleanupMedia();
    setLiveTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio Analyser for live mic orb pulsation
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length / 255;
            setAudioLevel(avg);

            // Real-time Voice Activity Detection (VAD) / Silence detection
            if (isHandsFree && avg > 0.08) {
              // User is actively speaking, reset silence timer
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            }

            animFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();
      } catch (e) {
        console.warn('Audio Context Analyser error:', e);
      }

      // Web Speech API for instantaneous live text streaming
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'vi' ? 'vi-VN' : language === 'zh' ? 'zh-CN' : language === 'ko' ? 'ko-KR' : 'en-US';

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript;
          }

          if (fullTranscript) {
            setLiveTranscript(fullTranscript);

            // If hands-free mode is on, debounce silence for 1.4 seconds to auto-send
            if (isHandsFree) {
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                const text = fullTranscript.trim();
                if (text.length > 2 && !isProcessingRef.current) {
                  processVoiceTurn(text);
                }
              }, 1400);
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }

      // MediaRecorder fallback
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(250);

      setState('listening');
      setStatusMessage('Listening to you... Speak freely');
    } catch (err: any) {
      console.error('Microphone error:', err);
      setState('idle');
      setStatusMessage('Microphone access required. Please enable permissions.');
    }
  };

  // Primary Single Mic Button / Orb Click Toggle
  const handlePrimaryMicToggle = () => {
    if (state === 'idle') {
      startListening();
    } else if (state === 'listening') {
      stopListening();
    } else if (state === 'speaking') {
      // Interrupt ChatGPT style
      cleanupMedia();
      setState('idle');
      setStatusMessage('Interrupted. Tap mic to speak again.');
    } else if (state === 'processing') {
      // Cancel
      cleanupMedia();
      setState('idle');
      setStatusMessage('Cancelled. Tap mic to start.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="chatgpt-voice-modal"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 text-white overflow-hidden backdrop-blur-3xl animate-in fade-in duration-300 select-none"
    >
      {/* Background ambient radial gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-sky-500/10 blur-[120px] pointer-events-none" />

      {/* 1. Sleek Minimalist Top Navigation Header (ChatGPT Style) */}
      <header className="relative z-20 flex w-full max-w-4xl items-center justify-between px-6 py-5">

        {/* Left: Mode selector pill */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={currentMode}
              onChange={(e) => onModeChange(e.target.value as ReflectionMode)}
              className="appearance-none rounded-full border border-white/15 bg-white/10 px-4 py-1.5 pr-8 text-xs font-semibold text-zinc-200 backdrop-blur-md focus:border-amber-400 focus:outline-none transition cursor-pointer hover:bg-white/15"
            >
              <option value="deep_reflection" className="bg-zinc-950 text-white">Deep Reflection</option>
              <option value="socratic_coach" className="bg-zinc-950 text-white">Socratic Coach</option>
              <option value="brainstorming" className="bg-zinc-950 text-white">Creative Brainstorm</option>
              <option value="action_planning" className="bg-zinc-950 text-white">Action Plan</option>
              <option value="gratitude_mindfulness" className="bg-zinc-950 text-white">Mindfulness & Peace</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              state === 'listening' ? 'bg-amber-400' : state === 'speaking' ? 'bg-sky-400' : 'bg-emerald-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              state === 'listening' ? 'bg-amber-500' : state === 'speaking' ? 'bg-sky-500' : 'bg-emerald-500'
            }`} />
          </span>
          <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
            Voice Mode
          </span>
        </div>

        {/* Right: Voice Persona, Hands-Free toggle, and Close */}
        <div className="flex items-center gap-2">
          {/* Voice Persona Selector */}
          <div className="relative hidden sm:block">
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="appearance-none rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 pr-7 text-xs font-medium text-amber-300 backdrop-blur-md focus:border-amber-400 focus:outline-none transition cursor-pointer hover:bg-white/15"
              title="Voice Persona"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-950 text-white">
                  {v.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400" />
          </div>

          {/* Hands-Free Auto-detect Toggle */}
          <button
            id="btn-toggle-handsfree"
            onClick={() => setIsHandsFree(!isHandsFree)}
            className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isHandsFree
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                : 'border-white/15 bg-white/5 text-zinc-400 hover:text-white'
            }`}
            title={isHandsFree ? 'Hands-Free (Auto pause detect)' : 'Push to Talk mode'}
          >
            <Radio className={`h-3 w-3 ${isHandsFree ? 'animate-pulse text-amber-400' : ''}`} />
            <span className="hidden sm:inline">{isHandsFree ? 'Auto Turn' : 'Manual'}</span>
          </button>

          {/* Mute Toggle */}
          <button
            id="btn-voice-mute"
            onClick={() => setIsMuted(!isMuted)}
            className={`rounded-full border p-2 text-xs transition ${
              isMuted
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
                : 'border-white/15 bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Close button */}
          <button
            id="btn-close-chatgpt-voice"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/10 p-2 text-zinc-400 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 2. Central Hero Stage: Iconic Fluid Voice Orb */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 w-full max-w-xl text-center">

        {/* Status Heading */}
        <div className="mb-8">
          <p className="text-base sm:text-lg font-medium text-zinc-200 transition-all duration-300">
            {statusMessage}
          </p>
          <p className="text-xs text-zinc-500 mt-1 truncate max-w-sm mx-auto">
            Session: {entryTitle}
          </p>
        </div>

        {/* Iconic Animated Center Orb */}
        <div className="relative my-4 flex items-center justify-center">
          <VoiceOrb
            state={state}
            audioLevel={audioLevel}
            onClick={handlePrimaryMicToggle}
            size="hero"
          />
        </div>

        {/* Real-Time Spoken Words Subtitle Stream */}
        <div className="mt-8 min-h-[64px] max-w-md w-full px-4 flex items-center justify-center">
          {liveTranscript ? (
            <p className="text-sm sm:text-base font-medium text-amber-200/90 leading-relaxed animate-pulse">
              &quot;{liveTranscript}&quot;
            </p>
          ) : state === 'listening' ? (
            <p className="text-xs text-zinc-500 italic">
              Speak your thoughts naturally, pausing when finished...
            </p>
          ) : state === 'speaking' ? (
            <p className="text-xs text-sky-400/80 font-medium">
              Tap anywhere or mic to interrupt
            </p>
          ) : (
            <p className="text-xs text-zinc-600">
              {isHandsFree ? 'Hands-free voice reflection active' : 'Tap the microphone button below to start'}
            </p>
          )}
        </div>

      </main>

      {/* 3. Bottom Control Bar: One Primary Mic Button + Transcript Toggle */}
      <footer className="relative z-20 flex w-full max-w-2xl flex-col items-center pb-8 pt-4 px-6 gap-4">

        {/* The One Primary Iconic Mic Button */}
        <div className="flex items-center justify-center gap-6">

          {/* Transcript Drawer Toggle */}
          <button
            id="btn-toggle-transcript"
            onClick={() => setShowTranscriptDrawer(!showTranscriptDrawer)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 backdrop-blur-md hover:bg-white/20 transition"
          >
            <MessageSquare className="h-4 w-4 text-amber-400" />
            <span>Transcript ({turns.length})</span>
            {showTranscriptDrawer ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronUp className="h-3 w-3 ml-1" />}
          </button>

          {/* Central Prominent Mic Toggle Button */}
          <button
            id="btn-primary-voice-mic"
            onClick={handlePrimaryMicToggle}
            className={`group relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 shadow-2xl ${
              state === 'listening'
                ? 'bg-amber-400 text-zinc-950 scale-110 shadow-[0_0_50px_rgba(245,158,11,0.7)] ring-4 ring-amber-300/50 animate-pulse'
                : state === 'speaking'
                ? 'bg-sky-400 text-zinc-950 scale-105 shadow-[0_0_40px_rgba(56,189,248,0.7)] ring-4 ring-sky-300/40'
                : state === 'processing'
                ? 'bg-purple-500 text-white scale-100 shadow-[0_0_30px_rgba(168,85,247,0.5)]'
                : 'bg-white text-zinc-950 hover:bg-amber-300 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]'
            }`}
            title={state === 'listening' ? 'Finish Speaking' : state === 'speaking' ? 'Interrupt' : 'Start Voice Chat'}
          >
            {state === 'listening' ? (
              <Square className="h-7 w-7 fill-zinc-950" />
            ) : state === 'speaking' ? (
              <Square className="h-7 w-7 fill-zinc-950" />
            ) : state === 'processing' ? (
              <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Mic className="h-8 w-8 transition-transform group-hover:scale-110" />
            )}
          </button>

          {/* Switch to Text Editor button */}
          <button
            id="btn-switch-to-text-editor"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 backdrop-blur-md hover:bg-white/20 transition"
          >
            <ArrowLeftRight className="h-4 w-4 text-sky-400" />
            <span>Text View</span>
          </button>

        </div>

      </footer>

      {/* 4. Slide-Up Transcript Sheet / Drawer */}
      {showTranscriptDrawer && (
        <div
          id="voice-transcript-drawer"
          className="absolute inset-x-0 bottom-0 z-30 max-h-[50vh] rounded-t-3xl border-t border-white/20 bg-zinc-950/95 backdrop-blur-2xl p-6 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Conversation Transcript
              </h4>
            </div>
            <button
              onClick={() => setShowTranscriptDrawer(false)}
              className="rounded-full p-1 text-zinc-400 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {turns.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 py-8">
                Your spoken conversation will appear here and save automatically to your journal.
              </p>
            ) : (
              turns.map((turn, i) => (
                <div
                  key={turn.id || i}
                  className={`rounded-2xl p-3.5 border text-xs sm:text-sm transition ${
                    turn.role === 'user'
                      ? 'border-amber-400/20 bg-amber-400/10 text-amber-100 ml-8'
                      : 'border-white/10 bg-white/5 text-zinc-200 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1 text-[10px] text-zinc-400">
                    <span className="font-bold flex items-center gap-1">
                      {turn.role === 'user' ? (
                        <>
                          <User className="h-3 w-3 text-amber-400" />
                          <span>You</span>
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3 text-sky-400" />
                          <span>Gemini Voice</span>
                        </>
                      )}
                    </span>
                    <span>
                      {new Date(turn.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {turn.content}
                  </p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

    </div>
  );
}
