import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini-server';
import { Modality } from '@google/genai';
import { pcmToWavBuffer, parseSampleRateFromMime } from '@/lib/audio-server';
import { ReflectionMode } from '@/lib/types';
import { generateProviderText, publicProviderError, readProviderCredentials } from '@/lib/ai-provider-server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getVoiceSystemInstruction(mode: ReflectionMode, language: string = 'en'): string {
  let langRule = 'Speak in English.';
  if (language === 'vi') {
    langRule = 'CRITICAL SPOKEN LANGUAGE: Respond completely in natural, warm, conversational Vietnamese (Tiếng Việt). Keep phrasing fluid and gentle.';
  } else if (language === 'zh') {
    langRule = 'CRITICAL SPOKEN LANGUAGE: Respond completely in natural, warm, conversational Mandarin Chinese (中文/普通话). Keep phrasing concise and soothing.';
  } else if (language === 'ko') {
    langRule = 'CRITICAL SPOKEN LANGUAGE: Respond completely in natural, warm, conversational Korean (한국어 / 존댓말/해요체). Keep phrasing empathetic.';
  }

  const base = `You are a real-time conversational voice reflection companion for a private journal app, powered by Gemini.
The user is speaking to you aloud in real time.
${langRule}
CRITICAL SPOKEN CONVERSATION RULES:
1. Speak naturally, warmly, empathetically, and concisely—exactly like a real-time spoken conversation (ChatGPT Voice Mode style).
2. Keep replies SHORT: 1 to 3 spoken sentences (max 40-50 words). Never use lists, bullet points, asterisks, markdown headers, or emojis.
3. Be an active, perceptive listener. Validate their thoughts and ask at most ONE thoughtful follow-up question to deepen their reflection.`;

  switch (mode) {
    case 'socratic_coach':
      return `${base}\nStyle: Socratic Coach. Briefly reflect their core dilemma, then ask one clarifying question that inspects their assumptions.`;
    case 'brainstorming':
      return `${base}\nStyle: Creative Spark. Offer one fresh perspective or creative angle on what they just shared.`;
    case 'action_planning':
      return `${base}\nStyle: Action Step. Help distill their thought into one small, immediate micro-action.`;
    case 'gratitude_mindfulness':
      return `${base}\nStyle: Mindful Presence. Acknowledge what they shared and guide them to savor the moment or notice a positive anchor.`;
    case 'deep_reflection':
    default:
      return `${base}\nStyle: Deep Reflection. Provide deep emotional resonance and mirror their subtext in two concise sentences.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('ai-voice', authResult.uid, 20, 60_000);
    if (rateLimit) return rateLimit;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const payload = body && typeof body === 'object' ? body : {};
    const credentials = readProviderCredentials(req);
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim().slice(0, 12000) : '';
    const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
    const mode = (payload.mode as ReflectionMode) || 'deep_reflection';
    const language = (['en', 'vi', 'zh', 'ko'].includes(payload.language) ? payload.language : 'en') as string;
    const voiceName = typeof payload.voice === 'string' && payload.voice ? payload.voice : 'Kore';

    if (!prompt) {
      return NextResponse.json(
        { error: 'Spoken prompt is required' },
        { status: 400 }
      );
    }

    // Build multi-turn context (last 6 turns for rapid focus)
    const contents: any[] = [];
    const recentHistory = history.slice(-6);
    for (const item of recentHistory) {
      if (item && typeof item.content === 'string' && item.content.trim()) {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const systemInstruction = getVoiceSystemInstruction(mode, language);

    // 1. Generate concise conversational speech text
    const { text: rawReply, modelUsed } = await generateProviderText({
      credentials,
      contents,
      systemInstruction,
      temperature: 0.75,
      maxOutputTokens: 160,
    });

    // Clean text for speech
    const cleanSpokenReply = rawReply
      .replace(/[*_#`~>[\]]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    // 2. Synthesize audio via Gemini TTS
    let base64Wav: string | null = null;
    const ai = credentials.provider === 'gemini' ? getGeminiClient(credentials.apiKey) : null;

    try {
      if (!ai) throw new Error('Native audio is available with Gemini; use browser speech fallback.');
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [
          {
            parts: [{ text: cleanSpokenReply }],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.[0];
      const rawBase64Audio = audioPart?.inlineData?.data;
      const originalMime = audioPart?.inlineData?.mimeType || 'audio/pcm;rate=24000';

      if (rawBase64Audio) {
        const pcmBuffer = Buffer.from(rawBase64Audio, 'base64');
        const sampleRate = parseSampleRateFromMime(originalMime, 24000);
        const wavBuffer = pcmToWavBuffer(pcmBuffer, sampleRate, 1);
        base64Wav = wavBuffer.toString('base64');
      }
    } catch {
      console.warn('Native voice synthesis failed; using browser speech fallback.');
    }

    return NextResponse.json({
      reply: cleanSpokenReply,
      audio: base64Wav,
      mimeType: base64Wav ? 'audio/wav' : null,
      voice: voiceName,
      modelUsed,
      fallbackWebSpeech: !base64Wav,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Voice conversation request failed:', error instanceof Error ? error.message : 'unknown');
    const safe = publicProviderError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
