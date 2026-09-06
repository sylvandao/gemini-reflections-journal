import { NextRequest, NextResponse } from 'next/server';
import { generateProviderText, publicProviderError, readProviderCredentials } from '@/lib/ai-provider-server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('ai-summary', authResult.uid, 10, 60_000);
    if (rateLimit) return rateLimit;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const payload = body && typeof body === 'object' ? body : {};
    const title = typeof payload.title === 'string' ? payload.title : 'Reflection';
    const turns = Array.isArray(payload.turns) ? payload.turns.slice(-80) : [];
    const language = (['en', 'vi', 'zh', 'ko'].includes(payload.language) ? payload.language : 'en') as string;

    if (turns.length === 0) {
      return NextResponse.json({ error: 'No conversation turns provided to summarize' }, { status: 400 });
    }

    let langNote = 'Generate all response fields in English.';
    if (language === 'vi') {
      langNote = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON text values (suggestedTitle, detectedMood, summary, keyInsights, actionItems) completely in natural, fluent, and elegant Vietnamese (Tiếng Việt).';
    } else if (language === 'zh') {
      langNote = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON text values (suggestedTitle, detectedMood, summary, keyInsights, actionItems) completely in natural, fluent, and refined Simplified Chinese (中文).';
    } else if (language === 'ko') {
      langNote = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON text values (suggestedTitle, detectedMood, summary, keyInsights, actionItems) completely in natural, respectful, and fluent Korean (한국어).';
    }

    const conversationText = turns
      .map((t: any) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${String(t.content || '').slice(0, 8000)}`)
      .join('\n\n')
      .slice(-60000);

    const prompt = `You are an expert synthesis engine analyzing a personal reflection and journaling dialogue between a User and Gemini AI.

Session Context / Current Title: "${title}"
${langNote}

Here is the conversation log:
---
${conversationText}
---

Please analyze this session and output a strictly valid JSON object matching this schema:
{
  "suggestedTitle": "A concise, evocative, 3 to 6 word title capturing the heart of this reflection in the target language",
  "detectedMood": "1 or 2 words describing the emotional tone in the target language (e.g., Biết ơn & Bình an, 感恩与宁静, 감사와 평온, Grateful & Centered)",
  "summary": "A cohesive, 2 to 3 sentence executive summary distilling the core themes, feelings, and realizations discussed in the target language.",
  "keyInsights": [
    "3 to 5 bullet points highlighting the most profound realizations, mindset shifts, or underlying themes in the target language"
  ],
  "actionItems": [
    "2 to 4 actionable next steps, micro-habits, or contemplative reflection prompts the user can carry forward in the target language"
  ]
}

Return ONLY valid JSON. Do not include markdown code block ticks (\`\`\`json) outside the JSON.`;

    const credentials = readProviderCredentials(req);
    const { text, modelUsed } = await generateProviderText({
      credentials,
      contents: prompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
      json: true,
    });

    let parsed: any;
    try {
      // Clean possible fences if any
      const cleaned = text.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('JSON parse error from Gemini summary, fallback structure:', parseErr);
      parsed = {
        suggestedTitle: title || 'Deep Reflection Session',
        detectedMood: 'Reflective',
        summary: text,
        keyInsights: ['Continuous self-inquiry fosters resilience and clarity.'],
        actionItems: ['Review notes before the next reflection session.'],
      };
    }

    return NextResponse.json({
      insight: {
        suggestedTitle: parsed.suggestedTitle || title,
        detectedMood: parsed.detectedMood || 'Reflective',
        summary: parsed.summary || 'Summary unavailable',
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      },
      modelUsed,
    });
  } catch (error: unknown) {
    console.error('AI summary request failed:', error instanceof Error ? error.message : 'unknown');
    const safe = publicProviderError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
