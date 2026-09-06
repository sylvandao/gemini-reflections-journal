'use client';

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  logOut,
  getUserJournalEntries,
  saveJournalEntry,
  deleteJournalEntry,
  logInteraction
} from '@/lib/firebase';
import { JournalEntry, Turn, ReflectionMode, InteractionRecord } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { LandingHero } from '@/components/LandingHero';
import { HistorySidebar } from '@/components/HistorySidebar';
import { EntryEditor } from '@/components/EntryEditor';
import { ExportModal } from '@/components/ExportModal';
import { VoiceAgentModal } from '@/components/VoiceAgentModal';
import { WeeklyDigestModal } from '@/components/WeeklyDigestModal';
import { AlertCircle, X, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useApiKey } from '@/lib/api-key';
import { apiFetch } from '@/lib/api-client';
import { ProviderSettings } from '@/components/ProviderSettings';

function createNewEntry(userId: string): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: 'New Reflection',
    category: 'Daily Reflection',
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'history' | 'providers'>('editor');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isWeeklyDigestOpen, setIsWeeklyDigestOpen] = useState(false);
  const [activeVoiceMode, setActiveVoiceMode] = useState<ReflectionMode>('deep_reflection');

  const { language } = useLanguage();
  const { apiKey, hasApiKey } = useApiKey();

  const requireApiKey = () => {
    if (apiKey) return true;
    setActiveView('providers');
    setErrorMessage('Connect an AI provider key to use AI features. BetterHuman never stores it.');
    return false;
  };

  // 1. Load Entries from Cloud Firestore
  const loadUserEntries = async (userId: string) => {
    setEntriesLoading(true);
    try {
      const userEntries = await getUserJournalEntries(userId);
      setEntries(userEntries);
      if (userEntries.length > 0) {
        setSelectedEntry(userEntries[0]);
      } else {
        const fresh = createNewEntry(userId);
        setSelectedEntry(fresh);
      }
    } catch (err: any) {
      console.error('Failed to load entries from Firestore:', err);
      setErrorMessage(
        'Could not load your journal entries from Cloud Firestore. Please check your network or try again.'
      );
    } finally {
      setEntriesLoading(false);
    }
  };

  // 2. Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        loadUserEntries(currentUser.uid);
      } else {
        setEntries([]);
        setSelectedEntry(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3. Auth Actions
  const handleSignIn = async () => {
    try {
      setErrorMessage(null);
      setAuthLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setErrorMessage(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setSelectedEntry(null);
      setEntries([]);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // 4. Create New Entry
  const handleNewEntry = () => {
    if (!user) return;
    const fresh = createNewEntry(user.uid);
    setSelectedEntry(fresh);
    setEntries((prev) => [fresh, ...prev]);
    setActiveView('editor');
    setIsMobileSidebarOpen(false);
  };

  // 5. Select Entry
  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setActiveView('editor');
    setIsMobileSidebarOpen(false);
  };

  // 6. Delete Entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      const remaining = entries.filter((e) => e.id !== entryId);
      setEntries(remaining);
      if (selectedEntry?.id === entryId) {
        setSelectedEntry(remaining.length > 0 ? remaining[0] : createNewEntry(user.uid));
      }
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      setErrorMessage('Failed to delete entry from Firestore.');
    }
  };

  // 7. Update Entry locally and persist to Firestore
  const handleUpdateEntry = async (updated: JournalEntry) => {
    setSelectedEntry(updated);
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );

    if (user) {
      setSaveStatus('saving');
      try {
        await saveJournalEntry(user.uid, updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Error auto-saving entry to Firestore:', err);
        setSaveStatus('error');
      }
    }
  };

  // 8. Submit Multi-Turn Prompt to Gemini
  const handleSendPrompt = async (prompt: string, mode: ReflectionMode) => {
    if (!user || !selectedEntry) return;
    if (!requireApiKey()) return;

    const userTurn: Turn = {
      id: `turn_u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      mode,
    };

    // Prepare updated turns
    const updatedTurns = [...selectedEntry.turns, userTurn];
    const updatedEntry: JournalEntry = {
      ...selectedEntry,
      turns: updatedTurns,
      // Auto-title on first turn if it's still default
      title:
        selectedEntry.turns.length === 0 && selectedEntry.title === 'New Reflection'
          ? prompt.slice(0, 36) + (prompt.length > 36 ? '...' : '')
          : selectedEntry.title,
      updatedAt: new Date().toISOString(),
    };

    // Immediate optimistic local update
    setSelectedEntry(updatedEntry);
    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );
    setIsGenerating(true);
    setSaveStatus('saving');

    try {
      // Call Gemini chat API
      const res = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: selectedEntry.turns,
          mode,
          entryTopic: selectedEntry.title,
          location: selectedEntry.location,
          language,
        }),
      }, { includeAiProvider: true });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to receive response from Gemini');
      }

      const data = await res.json();
      const modelReply = data.reply;
      const modelUsed = data.modelUsed || 'provider-default';

      const assistantTurn: Turn = {
        id: `turn_a_${Date.now()}`,
        role: 'assistant',
        content: modelReply,
        timestamp: new Date().toISOString(),
        mode,
      };

      const finalEntry: JournalEntry = {
        ...updatedEntry,
        turns: [...updatedTurns, assistantTurn],
        updatedAt: new Date().toISOString(),
      };

      // Update state
      setSelectedEntry(finalEntry);
      setEntries((prev) =>
        prev.map((e) => (e.id === finalEntry.id ? finalEntry : e))
      );

      // Save to Cloud Firestore
      await saveJournalEntry(user.uid, finalEntry);

      // Log isolated interaction
      const interactionRecord: InteractionRecord = {
        id: `inter_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.uid,
        entryId: finalEntry.id,
        prompt,
        response: modelReply,
        modelUsed,
        mode,
        timestamp: new Date().toISOString(),
      };
      await logInteraction(user.uid, interactionRecord);

      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error generating reflection:', err);
      setSaveStatus('error');
      setErrorMessage(
        err?.message || 'An error occurred while communicating with the AI provider.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 9. Real-Time Live Voice Turn Handler
  const handleVoiceSendTurn = async (
    prompt: string,
    mode: ReflectionMode,
    assistantReply?: string
  ): Promise<string | null> => {
    if (!user) return null;
    if (!requireApiKey()) return null;

    let targetEntry = selectedEntry;
    if (!targetEntry) {
      targetEntry = createNewEntry(user.uid);
      setSelectedEntry(targetEntry);
      setEntries((prev) => [targetEntry!, ...prev]);
    }

    const userTurn: Turn = {
      id: `turn_u_voice_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
      mode,
    };

    const updatedTurns = [...targetEntry.turns, userTurn];
    const updatedEntry: JournalEntry = {
      ...targetEntry,
      turns: updatedTurns,
      title:
        targetEntry.turns.length === 0 && targetEntry.title === 'New Reflection'
          ? prompt.slice(0, 36) + (prompt.length > 36 ? '...' : '')
          : targetEntry.title,
      updatedAt: new Date().toISOString(),
    };

    setSelectedEntry(updatedEntry);
    setEntries((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );
    setSaveStatus('saving');

    try {
      let finalModelReply = assistantReply;
      let modelUsed = 'provider-default';

      // If reply wasn't pre-generated by voice-conversation, generate it via chat
      if (!finalModelReply) {
        const res = await apiFetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            history: targetEntry.turns,
            mode,
            entryTopic: targetEntry.title,
            language,
          }),
        }, { includeAiProvider: true });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to receive voice response from Gemini');
        }

        const data = await res.json();
        finalModelReply = data.reply;
        modelUsed = data.modelUsed || 'provider-default';
      }

      const assistantTurn: Turn = {
        id: `turn_a_voice_${Date.now()}`,
        role: 'assistant',
        content: finalModelReply || '',
        timestamp: new Date().toISOString(),
        mode,
      };

      const finalEntry: JournalEntry = {
        ...updatedEntry,
        turns: [...updatedTurns, assistantTurn],
        updatedAt: new Date().toISOString(),
      };

      setSelectedEntry(finalEntry);
      setEntries((prev) =>
        prev.map((e) => (e.id === finalEntry.id ? finalEntry : e))
      );

      // Persist to Cloud Firestore
      await saveJournalEntry(user.uid, finalEntry);

      // Log interaction
      const interactionRecord: InteractionRecord = {
        id: `inter_voice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.uid,
        entryId: finalEntry.id,
        prompt,
        response: finalModelReply || '',
        modelUsed,
        mode,
        timestamp: new Date().toISOString(),
      };
      await logInteraction(user.uid, interactionRecord);

      setSaveStatus('saved');
      return finalModelReply || '';
    } catch (err: any) {
      console.error('Error during voice agent exchange:', err);
      setSaveStatus('error');
      setErrorMessage(
        err?.message || 'Failed to complete voice interaction.'
      );
      return null;
    }
  };

  // 10. Distill AI Insights & Summarize
  const handleSummarize = async () => {
    if (!user || !selectedEntry || selectedEntry.turns.length === 0) return;
    if (!requireApiKey()) return;

    setIsSummarizing(true);
    setSaveStatus('saving');
    try {
      const res = await apiFetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedEntry.title,
          turns: selectedEntry.turns,
          language,
        }),
      }, { includeAiProvider: true });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to synthesize summary');
      }

      const { insight } = await res.json();

      const updatedEntry: JournalEntry = {
        ...selectedEntry,
        summary: insight.summary,
        keyInsights: insight.keyInsights,
        actionItems: insight.actionItems,
        mood: insight.detectedMood || selectedEntry.mood,
        title:
          selectedEntry.title === 'New Reflection' && insight.suggestedTitle
            ? insight.suggestedTitle
            : selectedEntry.title,
        updatedAt: new Date().toISOString(),
      };

      setSelectedEntry(updatedEntry);
      setEntries((prev) =>
        prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
      );

      await saveJournalEntry(user.uid, updatedEntry);
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error summarizing session:', err);
      setSaveStatus('error');
      setErrorMessage(
        err?.message || 'Failed to generate summary and insights from Gemini.'
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#050508] font-sans text-zinc-100 antialiased selection:bg-amber-400 selection:text-zinc-950">

      {/* Top Navigation */}
      <Navbar
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onNewEntry={handleNewEntry}
        onOpenVoiceAgent={() => requireApiKey() && setIsVoiceModalOpen(true)}
        onOpenWeeklyDigest={() => requireApiKey() && setIsWeeklyDigestOpen(true)}
        onOpenApiKey={() => setActiveView('providers')}
        hasApiKey={hasApiKey}
        entriesCount={entries.length}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          id="global-error-banner"
          className="relative border-b border-rose-500/20 bg-rose-950/60 px-4 py-2.5 text-xs text-rose-200 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="rounded p-1 text-rose-300 hover:bg-rose-900/50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {authLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <p className="text-xs font-medium text-zinc-400">
                Verifying Firebase Authentication...
              </p>
            </div>
          </div>
        ) : activeView === 'providers' ? (
          <div className="mx-auto flex w-full max-w-7xl flex-1 border-x border-white/10 bg-zinc-950/40">
            <ProviderSettings />
          </div>
        ) : !user ? (
          <LandingHero onSignIn={handleSignIn} isLoading={authLoading} />
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto border-x border-white/10 bg-zinc-950/40 shadow-2xl backdrop-blur-xl relative">
            <>

            {/* Desktop / Tablet Sidebar */}
            <div className={`w-full lg:w-80 lg:block ${activeView === 'history' ? 'block' : 'hidden lg:block'}`}>
              <HistorySidebar
                entries={entries}
                selectedEntryId={selectedEntry?.id || null}
                onSelectEntry={handleSelectEntry}
                onNewEntry={handleNewEntry}
                onDeleteEntry={handleDeleteEntry}
                onExportAll={() => setIsExportModalOpen(true)}
                isLoading={entriesLoading}
              />
            </div>

            {/* Active Reflection Workspace */}
            <div className={`flex-1 flex flex-col ${activeView === 'editor' ? 'flex' : 'hidden lg:flex'}`}>
              {selectedEntry ? (
                <EntryEditor
                  entry={selectedEntry}
                  onUpdateEntry={handleUpdateEntry}
                  onSendPrompt={handleSendPrompt}
                  onSummarize={handleSummarize}
                  isGenerating={isGenerating}
                  isSummarizing={isSummarizing}
                  saveStatus={saveStatus}
                  onExport={() => setIsExportModalOpen(true)}
                  onOpenWeeklyDigest={() => requireApiKey() && setIsWeeklyDigestOpen(true)}
                  userEmail={user.email || undefined}
                  userName={user.displayName || undefined}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-12 text-center">
                  <div>
                    <Sparkles className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                    <p className="text-sm font-semibold text-white">
                      No reflection selected
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Choose an existing entry from the history or start a new reflection.
                    </p>
                    <button
                      onClick={handleNewEntry}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200"
                    >
                      Start Reflection
                    </button>
                  </div>
                </div>
              )}
            </div>

            </>
          </div>
        )}
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        entries={entries}
        currentEntry={selectedEntry}
      />

      {/* Real-Time Live Voice Agent Modal */}
      {selectedEntry && (
        <VoiceAgentModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          entryTitle={selectedEntry.title}
          turns={selectedEntry.turns}
          onSendTurn={handleVoiceSendTurn}
          currentMode={activeVoiceMode}
          onModeChange={setActiveVoiceMode}
        />
      )}

      {/* Weekly AI Digest & Growth Loop Modal */}
      {user && (
        <WeeklyDigestModal
          isOpen={isWeeklyDigestOpen}
          onClose={() => setIsWeeklyDigestOpen(false)}
          entries={entries}
          userId={user.uid}
          userName={user.displayName || 'Journalist'}
          userEmail={user.email || ''}
        />
      )}

    </div>
  );
}
