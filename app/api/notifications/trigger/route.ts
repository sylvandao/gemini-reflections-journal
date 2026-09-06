import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Secure Server-Side External Notification Dispatcher
 * Triggers Slack, Discord, and Email/Gmail alerts for urgent, crisis, or milestone journal entries.
 * Webhook URLs and API tokens are strictly isolated in process.env.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('notifications', authResult.uid, 10, 600_000);
    if (rateLimit) return rateLimit;
    const body = await req.json().catch(() => ({}));
    const {
      entryId,
      title = 'Untitled Reflection',
      priority = 'normal',
      mood,
      userEmail: requestedUserEmail,
      userName = 'Journal Author',
      location,
      summary,
      keyInsights = [],
      actionItems = [],
      forceTest = false,
    } = body;
    const userEmail = authResult.email || requestedUserEmail || '';

    // Check if notification is warranted
    const isUrgent = priority === 'urgent' || priority === 'crisis';
    const isSpecial = priority === 'important' || priority === 'milestone';
    const isTriggered = forceTest || isUrgent || isSpecial || (mood && ['urgent', 'critical', 'crisis', 'distressed', 'breakthrough'].includes(mood.toLowerCase()));

    if (!isTriggered) {
      return NextResponse.json({
        dispatched: false,
        message: 'Entry does not match critical notification triggers',
        priority,
      });
    }

    const timestamp = new Date().toISOString();
    const channelsDispatched: ('slack' | 'discord' | 'email' | 'webhook')[] = [];
    const dispatchErrors: string[] = [];

    // Construct privacy-safe alert payload (never leak raw unvetted private turns)
    const alertTitle = isUrgent
      ? `🚨 [URGENT JOURNAL ALERT] ${title}`
      : `🌟 [JOURNAL MILESTONE] ${title}`;

    const locationText = location?.name ? `📍 ${location.name}` : '';
    const safeSummary = summary || `High-priority reflection logged by ${userName}.`;

    // 1. Slack Webhook Integration
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      try {
        const slackPayload = {
          text: `${alertTitle}\n*Author:* ${userName} (${userEmail || 'Anonymous'})\n*Priority:* ${priority.toUpperCase()}\n*Summary:* ${safeSummary}\n${locationText}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: alertTitle.substring(0, 150),
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Priority:*\n\`${priority.toUpperCase()}\`` },
                { type: 'mrkdwn', text: `*Mood:*\n${mood || 'Unspecified'}` },
                { type: 'mrkdwn', text: `*Author:*\n${userName}` },
                { type: 'mrkdwn', text: `*Time:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${timestamp}>` },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*AI Executive Summary:*\n>${safeSummary}`,
              },
            },
          ],
        };

        const slackRes = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        if (slackRes.ok) {
          channelsDispatched.push('slack');
        } else {
          dispatchErrors.push(`Slack HTTP ${slackRes.status}`);
        }
      } catch (err: any) {
        console.error('Slack dispatch error:', err);
        dispatchErrors.push(`Slack error: ${err?.message}`);
      }
    }

    // 2. Discord Webhook Integration
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhookUrl) {
      try {
        const discordPayload = {
          content: isUrgent ? '@here **Urgent Journal Alert**' : '**New Journal Milestone**',
          embeds: [
            {
              title: alertTitle,
              description: safeSummary,
              color: isUrgent ? 0xef4444 : 0xf59e0b,
              fields: [
                { name: 'Author', value: userName, inline: true },
                { name: 'Priority', value: priority.toUpperCase(), inline: true },
                { name: 'Mood', value: mood || 'Reflective', inline: true },
                ...(location?.name ? [{ name: 'Location', value: location.name, inline: true }] : []),
              ],
              footer: { text: `GemJournal Notification Engine • ${timestamp}` },
            },
          ],
        };

        const discordRes = await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });

        if (discordRes.ok) {
          channelsDispatched.push('discord');
        } else {
          dispatchErrors.push(`Discord HTTP ${discordRes.status}`);
        }
      } catch (err: any) {
        console.error('Discord dispatch error:', err);
        dispatchErrors.push(`Discord error: ${err?.message}`);
      }
    }

    // 3. Email / Gmail Webhook Integration
    const gmailWebhook = process.env.GMAIL_NOTIFICATION_WEBHOOK || process.env.NOTIFICATION_EMAIL;
    if (gmailWebhook && gmailWebhook.startsWith('http')) {
      try {
        const emailPayload = {
          to: process.env.NOTIFICATION_EMAIL || userEmail,
          subject: alertTitle,
          entryTitle: title,
          priority,
          mood,
          author: userName,
          summary: safeSummary,
          timestamp,
        };
        const emailRes = await fetch(gmailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        });
        if (emailRes.ok) {
          channelsDispatched.push('email');
        }
      } catch (err: any) {
        dispatchErrors.push(`Email error: ${err?.message}`);
      }
    }

    const dispatched = channelsDispatched.length > 0;
    return NextResponse.json({
      dispatched,
      timestamp,
      channels: channelsDispatched,
      triggerReason: `Priority: ${priority}${mood ? ` | Mood: ${mood}` : ''}${forceTest ? ' (Manual Test Trigger)' : ''}`,
      status: dispatched ? 'delivered' : (dispatchErrors.length > 0 ? 'failed' : 'simulated'),
      details: dispatchErrors.length > 0
        ? 'One or more configured notification channels failed.'
        : dispatched
          ? 'Configured notification channels dispatched successfully.'
          : 'No server-side notification channels are configured.',
    });
  } catch (error: unknown) {
    console.error('Notification dispatch failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Failed to dispatch external notifications' }, { status: 500 });
  }
}
