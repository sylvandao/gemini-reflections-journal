import { NextRequest, NextResponse } from 'next/server';
import { ReflectionMode, SupportedLanguage } from '@/lib/types';
import { generateProviderText, publicProviderError, readProviderCredentials } from '@/lib/ai-provider-server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getSystemInstructionForMode(
  mode: ReflectionMode,
  language: SupportedLanguage = 'en',
  entryTopic?: string,
  locationName?: string,
  locationAddress?: string
): string {
  let locNote = '';
  if (locationName) {
    locNote = `\nContext Note: The user is currently writing from or reflecting on "${locationName}"${locationAddress ? ` (${locationAddress})` : ''}. If relevant, gently acknowledge their atmosphere or surroundings with natural poise.`;
  }

  let langInstruction = 'Always respond in natural, clear, empathetic English.';
  if (language === 'vi') {
    langInstruction = 'CRITICAL LANGUAGE DIRECTIVE: Always respond completely in natural, fluent, warm, and idiomatic Vietnamese (Tiếng Việt). Use appropriate pronouns and gentle, reflective phrasing.';
  } else if (language === 'zh') {
    langInstruction = 'CRITICAL LANGUAGE DIRECTIVE: Always respond completely in natural, elegant, fluent Simplified Chinese (中文). Use warm, philosophical, and empathetic phrasing.';
  } else if (language === 'ko') {
    langInstruction = 'CRITICAL LANGUAGE DIRECTIVE: Always respond completely in natural, respectful, and warm Korean (한국어 / 해요체/하십시오체). Show genuine empathy and thoughtful insight.';
  }

  const base = `You are a thoughtful, empathetic, and intellectually sharp AI Reflection Partner & Journaling Guide powered by Gemini.
The user is having a personal reflection session.
${langInstruction}
Speak in a warm, concise, and deeply observant tone.
Reflect back subtle themes, validate their genuine feelings, challenge cognitive biases gently, and ask stimulating follow-up questions when relevant.
Format your responses cleanly with Markdown (bullet points, bold highlights, concise paragraphs). Keep replies engaging and proportional (typically 2-4 focused paragraphs or key reflections).${locNote}
`;

  switch (mode) {
    case 'socratic_coach':
      return `${base}\nMode: Socratic Coach. Ask 1-2 profound, clarifying questions that encourage the user to inspect their assumptions, underlying motives, or alternative viewpoints.`;
    case 'brainstorming':
      return `${base}\nMode: Creative Brainstorming & Lateral Thinking. Offer diverse angles, unexpected ideas, analogies, and creative possibilities based on what the user shared.`;
    case 'action_planning':
      return `${base}\nMode: Action Planning & Pragmatism. Help the user transform their reflections into clear, small, high-leverage executable steps and habit micro-commitments.`;
    case 'gratitude_mindfulness':
      return `${base}\nMode: Gratitude & Mindfulness. Help the user anchor in presence, acknowledge small wins, express gratitude, and reframe tension with self-compassion.`;
    case 'deep_reflection':
    default:
      return `${base}\nMode: Deep Reflection. Provide deep synthesis of emotional subtext, core themes, and personal growth opportunities.`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('ai-text', authResult.uid, 30, 60_000);
    if (rateLimit) return rateLimit;
    // 1. Top-Level Request Deserialization (Null-Safe Destructuring)
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
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim().slice(0, 12000) : '';
    const history = Array.isArray(payload.history) ? payload.history.slice(-40) : [];
    const mode = (payload.mode as ReflectionMode) || 'deep_reflection';
    const language = (['en', 'vi', 'zh', 'ko'].includes(payload.language) ? payload.language : 'en') as SupportedLanguage;
    const entryTopic = typeof payload.entryTopic === 'string' ? payload.entryTopic : '';
    const location = payload.location && typeof payload.location === 'object' ? payload.location : null;
    const locationName = typeof location?.name === 'string' ? location.name : undefined;
    const locationAddress = typeof location?.formattedAddress === 'string' ? location.formattedAddress : (typeof location?.address === 'string' ? location.address : undefined);

    if (!prompt && history.length === 0) {
      return NextResponse.json(
        { error: 'A prompt or valid conversation history is required' },
        { status: 400 }
      );
    }

    // 2. Format multi-turn contents for Gemini SDK
    const contents: any[] = [];

    // Add prior turns
    for (const item of history) {
      if (item && typeof item.content === 'string' && item.content.trim()) {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content }],
        });
      }
    }

    // Add current user prompt if provided
    if (prompt) {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    const credentials = readProviderCredentials(req);
    const systemInstruction = getSystemInstructionForMode(mode, language, entryTopic, locationName, locationAddress);

    const { text, modelUsed } = await generateProviderText({
      credentials,
      contents,
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    return NextResponse.json({
      reply: text,
      modelUsed,
      language,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('AI chat request failed:', error instanceof Error ? error.message : 'unknown');
    const safe = publicProviderError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
