import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini-server';
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
    const base64Audio = typeof payload.audio === 'string' ? payload.audio.trim() : '';
    const mimeType = typeof payload.mimeType === 'string' && payload.mimeType ? payload.mimeType : 'audio/webm';

    if (!base64Audio || base64Audio.length > 14_000_000) {
      return NextResponse.json(
        { error: 'Audio data (base64) is required for transcription' },
        { status: 400 }
      );
    }

    if (credentials.provider !== 'gemini') {
      return NextResponse.json({ error: 'Server transcription currently requires Gemini. Browser speech recognition remains available.' }, { status: 400 });
    }
    const ai = getGeminiClient(credentials.apiKey);

    // Transcribe with the dedicated model, then a current stable multimodal fallback.
    let transcript = '';
    const audioPart = {
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            audioPart,
            { text: 'Transcribe this user journal reflection audio verbatim. Do not add commentary or introductory phrases.' }
          ],
        },
      });
      transcript = response.text?.trim() || '';
    } catch {
      console.warn('Dedicated transcription model failed; using the stable multimodal fallback.');
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            audioPart,
            { text: 'Transcribe this user speech accurately into text. Output only the spoken words without extra commentary.' }
          ],
        },
      });
      transcript = fallbackResponse.text?.trim() || '';
    }

    return NextResponse.json({
      transcript,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Transcription request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Audio transcription could not be completed.' }, { status: 502 });
  }
}
