import { GoogleGenAI, Modality } from '@google/genai';
import { pcmToWavBuffer } from './audio';

// Resilient Model Fallback Ladder defined in Directives
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

export function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const cleanKey = customApiKey?.trim();
  if (!cleanKey) {
    throw new Error('Connect your Google AI Studio API key to use Gemini. The key is used for this request only and is never stored.');
  }

  return new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      headers: {
        'User-Agent': 'betterhuman-journal',
      },
    },
  });
}

export interface FallbackOptions {
  contents: any;
  config?: any;
  apiKey?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\b(400|401|403|404|408|409|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : 502;
}

/**
 * Resilient Gemini Content Generation:
 * Attempts generation across the fallback ladder with retry and jitter on transient errors.
 */
export async function generateContentWithFallback(options: FallbackOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient(options.apiKey);
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    // Retry up to 2 attempts per model for transient glitches/429 bursts
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: options.contents,
          config: options.config,
        });

        const outputText = response.text || '';
        return {
          text: outputText,
          modelUsed: modelName,
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const status = providerStatus(err);
        const isRateLimitOrTransient = status === 429 || status === 503 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('fetch');

        if (attempt === 1 && isRateLimitOrTransient) {
          const jitter = Math.floor(Math.random() * 300) + 200;
          await sleep(jitter);
          continue;
        }

        console.warn(`[Gemini Fallback] ${modelName} attempt ${attempt} failed with status ${status}; trying fallback.`);
        break;
      }
    }
  }

  throw new Error(`PROVIDER_REQUEST_FAILED:${providerStatus(lastError)}`);
}

/**
 * Google GenAI TTS: Synthesize speech from text using Gemini 3.1 Flash TTS Preview.
 */
export async function synthesizeSpeechWithFallback(
  text: string,
  voiceName: string = 'Kore',
  customApiKey?: string
): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getGeminiClient(customApiKey);

  // Clean and prepare the text for natural reading (strip markdown symbols like *, #, etc.)
  const cleanedText = text
    .replace(/[#*_`~>[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 1500); // Keep reasonable length for audio response

  if (!cleanedText) {
    throw new Error('Text to synthesize cannot be empty');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: cleanedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p) => p.inlineData && p.inlineData.data);

    if (audioPart?.inlineData?.data) {
      const rawBase64 = audioPart.inlineData.data;
      const rawBuffer = Buffer.from(rawBase64, 'base64');

      // If audio already contains a RIFF header, return as is; otherwise wrap PCM in standard WAV
      if (rawBuffer.length > 4 && rawBuffer.toString('utf8', 0, 4) === 'RIFF') {
        return {
          audioBase64: rawBase64,
          mimeType: 'audio/wav',
        };
      }

      // Convert 24kHz raw PCM to playable WAV
      const wavBuffer = pcmToWavBuffer(rawBuffer, 24000, 1, 16);
      return {
        audioBase64: wavBuffer.toString('base64'),
        mimeType: 'audio/wav',
      };
    }

    throw new Error('No audio content returned by Gemini TTS');
  } catch (err: any) {
    console.error(`[Gemini TTS] Synthesis failed with status ${providerStatus(err)}.`);
    throw err;
  }
}

/**
 * Google GenAI Audio Transcription: Transcribe audio recording into text using gemini-3.5-transcribe
 * or multimodal audio fallback.
 */
export async function transcribeAudioWithFallback(
  base64Audio: string,
  mimeType: string = 'audio/webm',
  customApiKey?: string
): Promise<{ transcript: string; modelUsed: string }> {
  const ai = getGeminiClient(customApiKey);
  const modelsToTry = ['gemini-3.5-transcribe', 'gemini-3.6-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  const audioPart = {
    inlineData: {
      mimeType: mimeType || 'audio/webm',
      data: base64Audio,
    },
  };

  const textPart = {
    text: 'Transcribe this voice journal recording word-for-word into clear, naturally punctuated text. Do not add conversational commentary or meta-text, only return the exact spoken transcript.',
  };

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [audioPart, textPart] },
      });

      const transcript = (response.text || '').trim();
      return {
        transcript,
        modelUsed: modelName,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Transcription] ${modelName} failed with status ${providerStatus(err)}.`);
    }
  }

  throw new Error(`PROVIDER_REQUEST_FAILED:${providerStatus(lastError)}`);
}
