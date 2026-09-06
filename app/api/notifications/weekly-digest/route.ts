import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { JournalEntry, WeeklyDigestConfig, WeeklyDigestResult, WeeklyGoalItem } from '@/lib/types';
import { generateProviderText, publicProviderError, readProviderCredentials } from '@/lib/ai-provider-server';
import { enforceRateLimit } from '@/lib/rate-limit';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Weekly AI Reflection Digest & Re-Engagement Loop Dispatcher
 * Synthesizes 7-day reflections, tracks weekly goals with gentle follow-ups,
 * and delivers via Gmail/Google Apps Script, Discord, and Slack.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('weekly-digest', authResult.uid, 3, 600_000);
    if (rateLimit) return rateLimit;
    const body = await req.json().catch(() => ({}));
    const credentials = readProviderCredentials(req);
    const {
      userId: requestedUserId,
      userEmail: requestedUserEmail = '',
      userName = 'Journal Explorer',
      entries = [],
      config,
      language = 'en',
    } = body as {
      userId: string;
      userEmail?: string;
      userName?: string;
      entries?: JournalEntry[];
      config?: Partial<WeeklyDigestConfig>;
      language?: string;
    };

    const userId = authResult.uid;
    const userEmail = authResult.email || requestedUserEmail;
    if (requestedUserId && requestedUserId !== authResult.uid) {
      return NextResponse.json({ error: 'You may only generate your own digest.' }, { status: 403 });
    }
    if (!entries || entries.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No journal entries available to synthesize for this week.',
      }, { status: 400 });
    }

    // Format entry logs for Gemini analysis
    const entryContext = entries.slice(0, 15).map((e, idx) => {
      const turnsText = (e.turns || [])
        .map((t) => `${t.role === 'user' ? 'Author' : 'AI'}: ${t.content}`)
        .join('\n');
      return `--- [Entry ${idx + 1}: "${e.title}"] (Date: ${e.createdAt || 'Recent'}, Category: ${e.category || 'General'}, Mood: ${e.mood || 'Unspecified'}) ---\n${e.summary ? `Summary: ${e.summary}\n` : ''}${turnsText}`;
    }).join('\n\n');

    // Calculate dates
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekRange = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    let langDirective = 'Synthesize all content in English.';
    if (language === 'vi') {
      langDirective = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON values (coreTheme, executiveSummary, keyBreakthroughs, goalFollowUps, moodTrajectory, reflectionQuestionForNextWeek) completely in natural, warm, and inspiring Vietnamese (Tiếng Việt).';
    } else if (language === 'zh') {
      langDirective = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON values (coreTheme, executiveSummary, keyBreakthroughs, goalFollowUps, moodTrajectory, reflectionQuestionForNextWeek) completely in natural, elegant, and inspiring Simplified Chinese (中文).';
    } else if (language === 'ko') {
      langDirective = 'CRITICAL LANGUAGE DIRECTIVE: Output all JSON values (coreTheme, executiveSummary, keyBreakthroughs, goalFollowUps, moodTrajectory, reflectionQuestionForNextWeek) completely in natural, warm, and inspiring Korean (한국어).';
    }

    // Generate Weekly Synthesis with Gemini Fallback Ladder
    const prompt = `You are the empathetic, insightful AI Journaling Mentor for ${userName}.
Below are their personal journal reflections from the past week (${weekRange}):
${langDirective}

${entryContext}

Please synthesize this week's reflections to create a high-value, encouraging Weekly Re-Engagement Digest that celebrates their progress and offers a gentle check-in on goals they wrote about earlier in the week.

Respond STRICTLY in valid JSON matching this exact structure:
{
  "coreTheme": "Short evocative title of their weekly mental arc (e.g., 'Navigating Ambiguity with Resilient Focus')",
  "executiveSummary": "2-3 warm, deeply personalized paragraphs summarizing their mindset, wins, stress factors, and emotional growth this week.",
  "keyBreakthroughs": [
    "Specific breakthrough or realization 1",
    "Specific breakthrough or realization 2",
    "Specific breakthrough or realization 3"
  ],
  "goalFollowUps": [
    {
      "goal": "Name of a goal, intention, or commitment they mentioned",
      "sourceEntryTitle": "Title of the entry where it was mentioned",
      "status": "in_progress",
      "followUpNote": "A supportive, gentle coaching check-in question on how this went and how to carry it forward."
    }
  ],
  "moodTrajectory": "Brief summary of their emotional flow across the week (e.g. 'Started overwhelmed on Monday, found clarity through deep inquiry by Thursday')",
  "reflectionQuestionForNextWeek": "One powerful, thought-provoking question to ponder entering next week that makes them excited to open their journal."
}
Only output the JSON object without markdown formatting.`;

    const { text: geminiRaw } = await generateProviderText({
      credentials,
      contents: prompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
      json: true,
    });

    let digestData: any = {};
    try {
      digestData = JSON.parse(geminiRaw);
    } catch {
      const match = geminiRaw.match(/\{[\s\S]*\}/);
      if (match) digestData = JSON.parse(match[0]);
    }

    const coreTheme = digestData.coreTheme || 'Weekly Growth & Self-Discovery';
    const executiveSummary = digestData.executiveSummary || 'A productive week of mindful reflection and thoughtful inquiry.';
    const keyBreakthroughs: string[] = digestData.keyBreakthroughs || ['Cultivated deeper self-awareness across daily challenges.'];
    const goalFollowUps: WeeklyGoalItem[] = digestData.goalFollowUps || [];
    const moodTrajectory = digestData.moodTrajectory || 'Balanced and self-reflective throughout the week.';
    const reflectionQuestionForNextWeek = digestData.reflectionQuestionForNextWeek || 'What is the single most meaningful focus you want to nurture in the days ahead?';

    // Build Responsive HTML Email Template
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gemjournal.app';
    const safeAppUrl = /^https:\/\//i.test(appUrl) ? escapeHtml(appUrl) : 'https://betterhuman.ai.studio';
    const safeCoreTheme = escapeHtml(coreTheme);
    const safeUserName = escapeHtml(userName);
    const safeWeekRange = escapeHtml(weekRange);
    const safeExecutiveSummary = escapeHtml(executiveSummary);
    const safeReflectionQuestion = escapeHtml(reflectionQuestionForNextWeek);
    const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly AI Journal Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0c0e14; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #121622; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">

          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(13,148,136,0.1) 100%); border-bottom: 1px solid rgba(255,255,255,0.08);">
              <div style="display: inline-block; padding: 4px 12px; background-color: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); border-radius: 999px; font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                ✨ Weekly AI Reflection Digest
              </div>
              <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                ${safeCoreTheme}
              </h1>
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                ${safeUserName} • ${safeWeekRange} • ${entries.length} reflections recorded
              </p>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h2 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #fbbf24; font-weight: 700;">
                Executive Growth Arc
              </h2>
              <div style="font-size: 15px; line-height: 1.65; color: #d1d5db; white-space: pre-line;">
                ${safeExecutiveSummary}
              </div>
            </td>
          </tr>

          <!-- Key Breakthroughs -->
          ${keyBreakthroughs.length > 0 ? `
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.06); background-color: rgba(255,255,255,0.01);">
              <h2 style="margin: 0 0 14px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #34d399; font-weight: 700;">
                💡 Key Insights & Mindset Breakthroughs
              </h2>
              <ul style="margin: 0; padding-left: 20px; color: #e4e4e7; font-size: 14px; line-height: 1.6;">
                ${keyBreakthroughs.map((b) => `<li style="margin-bottom: 8px;">${escapeHtml(b)}</li>`).join('')}
              </ul>
            </td>
          </tr>` : ''}

          <!-- Goal & Commitment Follow-ups -->
          ${goalFollowUps.length > 0 ? `
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h2 style="margin: 0 0 14px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; color: #60a5fa; font-weight: 700;">
                🎯 Active Commitments & Goal Follow-Up
              </h2>
              ${goalFollowUps.map((g) => `
                <div style="margin-bottom: 14px; padding: 14px; background-color: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); border-radius: 12px;">
                  <div style="font-size: 14px; font-weight: 700; color: #93c5fd; margin-bottom: 4px;">
                    📌 ${escapeHtml(g.goal)}
                  </div>
                  <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                    ${escapeHtml(g.followUpNote)}
                  </div>
                </div>
              `).join('')}
            </td>
          </tr>` : ''}

          <!-- Next Week's Reflection Question & CTA -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(180deg, rgba(18,22,34,1) 0%, rgba(26,32,48,1) 100%); text-align: center;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a78bfa; margin-bottom: 8px;">
                🌱 Prompt for the New Week
              </div>
              <p style="margin: 0 0 24px; font-size: 17px; font-weight: 600; font-style: italic; color: #ffffff; line-height: 1.5;">
                "${safeReflectionQuestion}"
              </p>

              <a href="${safeAppUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000000; font-weight: 800; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 6px 20px rgba(245,158,11,0.35);">
                Open GemJournal & Reflect →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 32px; background-color: #0c0e14; text-align: center; font-size: 11px; color: #71717a;">
              GemJournal Habit Re-Engagement Engine • Automated mindful synthesis powered by Gemini AI.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Multi-channel dispatching
    const channelsDispatched: ('email' | 'discord' | 'slack' | 'app')[] = ['app'];
    const dispatchErrors: string[] = [];

    const effectiveConfig = config || {};
    // Destinations are server-controlled. Never fetch user-provided webhook URLs (SSRF).
    const targetEmail = userEmail;
    const gmailWebhook = process.env.GMAIL_NOTIFICATION_WEBHOOK;
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;

    // 1. Google Apps Script / Gmail Dispatch
    if (gmailWebhook && (effectiveConfig.channels?.email !== false)) {
      try {
        const appsScriptPayload = {
          toEmail: targetEmail,
          userEmail: targetEmail,
          subject: `✨ Your Weekly AI Journal Digest: ${coreTheme}`,
          theme: coreTheme,
          summary: executiveSummary,
          weekRange,
          entriesCount: entries.length,
          breakthroughs: keyBreakthroughs,
          goals: goalFollowUps,
          reflectionPrompt: reflectionQuestionForNextWeek,
          htmlBody: htmlEmail,
          textBody: `Weekly Reflection Digest for ${userName} (${weekRange})\n\nTheme: ${coreTheme}\n\nSummary:\n${executiveSummary}\n\nKey Insights:\n${keyBreakthroughs.map(k => `• ${k}`).join('\n')}\n\nReflection Question:\n${reflectionQuestionForNextWeek}\n\nOpen GemJournal: ${appUrl}`,
        };

        const res = await fetch(gmailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appsScriptPayload),
        });

        if (res.ok) {
          channelsDispatched.push('email');
        } else {
          dispatchErrors.push(`Apps Script HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.warn('Apps Script dispatch exception:', err);
        dispatchErrors.push(`Apps Script: ${err?.message}`);
      }
    }

    // 2. Discord Webhook Dispatch
    if (discordWebhook && effectiveConfig.channels?.discord) {
      try {
        const discordPayload = {
          content: `✨ **Weekly AI Reflection Digest for ${userName}** (${weekRange})`,
          embeds: [
            {
              title: `🌱 ${coreTheme}`,
              description: executiveSummary.slice(0, 1000),
              color: 0xf59e0b,
              fields: [
                ...(keyBreakthroughs.length > 0 ? [{
                  name: '💡 Breakthroughs of the Week',
                  value: keyBreakthroughs.map(b => `• ${b}`).join('\n'),
                }] : []),
                ...(goalFollowUps.length > 0 ? [{
                  name: '🎯 Goal Follow-Ups',
                  value: goalFollowUps.map(g => `**${g.goal}:** ${g.followUpNote}`).join('\n\n').slice(0, 1000),
                }] : []),
                {
                  name: '🌱 Prompt for the New Week',
                  value: `*${reflectionQuestionForNextWeek}*`,
                },
              ],
              footer: { text: `GemJournal Weekly Re-Engagement Loop • ${entries.length} reflections synthesized` },
            },
          ],
        };

        const res = await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });

        if (res.ok) channelsDispatched.push('discord');
      } catch (err: any) {
        dispatchErrors.push(`Discord: ${err?.message}`);
      }
    }

    // 3. Slack Webhook Dispatch
    if (slackWebhook && effectiveConfig.channels?.slack) {
      try {
        const slackPayload = {
          text: `✨ *Weekly AI Reflection Digest for ${userName}*\n*Theme:* ${coreTheme}\n\n>${executiveSummary.slice(0, 500)}\n\n*Prompt for Next Week:*\n_${reflectionQuestionForNextWeek}_\n\n<${appUrl}|Open GemJournal →>`,
        };
        const res = await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });
        if (res.ok) channelsDispatched.push('slack');
      } catch (err: any) {
        dispatchErrors.push(`Slack: ${err?.message}`);
      }
    }

    const result: WeeklyDigestResult = {
      userId: userId || 'anonymous',
      userName,
      weekRange,
      totalEntriesThisWeek: entries.length,
      coreTheme,
      executiveSummary,
      keyBreakthroughs,
      goalFollowUps,
      moodTrajectory,
      reflectionQuestionForNextWeek,
      dispatchedChannels: channelsDispatched,
      htmlBody: htmlEmail,
      dispatchedAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      digest: result,
      dispatchedChannels: channelsDispatched,
      errors: dispatchErrors,
      message: `Weekly digest synthesized successfully across ${channelsDispatched.join(', ')}.`,
    });
  } catch (error: unknown) {
    console.error('Weekly digest request failed:', error instanceof Error ? error.message : 'unknown');
    const safe = publicProviderError(error);
    return NextResponse.json({ success: false, error: safe.message }, { status: safe.status });
  }
}
