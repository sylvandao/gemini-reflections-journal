export type SupportedLanguage = 'en' | 'vi' | 'zh' | 'ko';

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
  createdAt: string;
  lastLoginAt: string;
  totalEntries?: number;
}

export type ReflectionMode =
  | 'deep_reflection'
  | 'socratic_coach'
  | 'brainstorming'
  | 'action_planning'
  | 'gratitude_mindfulness';

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
}

export interface EntryInsight {
  summary: string;
  keyInsights: string[];
  actionItems: string[];
  suggestedTitle?: string;
  detectedMood?: string;
}

export interface EntryLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  formattedAddress?: string;
  mapsUrl?: string;
  category?: string;
  placeType?: string;
  customLabel?: string;
  ambientVibe?: string;
}

export type EntryPriority = 'normal' | 'important' | 'urgent' | 'crisis' | 'milestone';

export interface NotificationDispatchStatus {
  dispatched: boolean;
  timestamp: string;
  channels: ('slack' | 'discord' | 'email' | 'webhook')[];
  recipients?: string[];
  triggerReason: string;
  status: 'delivered' | 'simulated' | 'failed' | 'queued';
  details?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  category: string;
  mood?: string;
  priority?: EntryPriority;
  location?: EntryLocation;
  notificationStatus?: NotificationDispatchStatus;
  turns: Turn[];
  summary?: string;
  keyInsights?: string[];
  actionItems?: string[];
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

export interface InteractionRecord {
  id: string;
  userId: string;
  entryId: string;
  prompt: string;
  response: string;
  modelUsed: string;
  mode: ReflectionMode;
  timestamp: string;
}

export interface WeeklyDigestConfig {
  enabled: boolean;
  deliveryDay: 'sunday' | 'monday' | 'friday';
  channels: {
    email: boolean;
    discord: boolean;
    slack: boolean;
    appOnly: boolean;
  };
  destinationEmail?: string;
  discordWebhookUrl?: string;
  slackWebhookUrl?: string;
  gmailAppsScriptUrl?: string;
  lastDispatchedAt?: string;
}

export interface WeeklyGoalItem {
  goal: string;
  sourceEntryTitle?: string;
  status: 'in_progress' | 'completed' | 'needs_attention';
  followUpNote: string;
}

export interface WeeklyDigestResult {
  userId: string;
  userName: string;
  weekRange: string;
  totalEntriesThisWeek: number;
  coreTheme: string;
  executiveSummary: string;
  keyBreakthroughs: string[];
  goalFollowUps: WeeklyGoalItem[];
  moodTrajectory: string;
  reflectionQuestionForNextWeek: string;
  dispatchedChannels: ('email' | 'discord' | 'slack' | 'app')[];
  htmlBody?: string;
  dispatchedAt: string;
}


export interface SystemAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  details: string;
  category: 'auth' | 'rbac' | 'notification' | 'security' | 'entry';
}
