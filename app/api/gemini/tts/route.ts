import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini-server';
import { Modality } from '@google/genai';
import { pcmToWavBuffer, parseSampleRateFromMime } from '@/lib/audio-server';
import { readProviderCredentials } from '@/lib/ai-provider-server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('ai-audio', authResult.uid, 20, 60_000);
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
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    const voiceName = typeof payload.voice === 'string' && payload.voice ? payload.voice : 'Kore';

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required for TTS generation' },
        { status: 400 }
      );
    }

    // Clean text of markdown and excessive symbols for natural speech
    const cleanText = text
      .replace(/[*_#`~>[\]]/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 1000);

    if (credentials.provider !== 'gemini') {
      return NextResponse.json({ fallback: true, message: 'Using on-device speech for this provider.', text: cleanText, voice: voiceName });
    }
    const ai = getGeminiClient(credentials.apiKey);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [
          {
            parts: [{ text: cleanText }],
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

      const audioPart = response.candidates?.[0]?.content?.parts?.[0];
      const rawBase64Audio = audioPart?.inlineData?.data;
      const originalMime = audioPart?.inlineData?.mimeType || 'audio/pcm;rate=24000';

      if (!rawBase64Audio) {
        throw new Error('No audio content returned by Gemini TTS');
      }

      // Convert raw PCM to standard playable WAV buffer
      const pcmBuffer = Buffer.from(rawBase64Audio, 'base64');
      const sampleRate = parseSampleRateFromMime(originalMime, 24000);
      const wavBuffer = pcmToWavBuffer(pcmBuffer, sampleRate, 1);
      const base64Wav = wavBuffer.toString('base64');

      return NextResponse.json({
        audio: base64Wav,
        mimeType: 'audio/wav',
        voice: voiceName,
        fallback: false,
      });
    } catch {
      console.warn('Native voice synthesis failed; using browser speech fallback.');
      // Return fallback flag so client seamlessly uses Web Speech API
      return NextResponse.json({
        fallback: true,
        message: 'TTS model unavailable, fallback to client speech synthesis',
        text: cleanText,
        voice: voiceName,
      });
    }
  } catch (error: unknown) {
    console.error('TTS request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ fallback: true, message: 'Using on-device speech instead.' });
  }
}
