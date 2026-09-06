'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Sparkles,
  Calendar,
  Clock,
  Tag,
  ChevronRight,
  Filter,
  Download,
  MapPin,
  AlertTriangle,
  Bell
} from 'lucide-react';
import { JournalEntry } from '@/lib/types';

interface HistorySidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onExportAll: () => void;
  isLoading: boolean;
}

const CATEGORIES = [
  'All',
  'Daily Reflection',
  'Brainstorming',
  'Mindfulness',
  'Decision Making',
  'Personal Growth',
];

export function HistorySidebar({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onExportAll,
  isLoading,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesCategory =
      selectedCategory === 'All' || entry.category === selectedCategory;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(query) ||
      (entry.summary && entry.summary.toLowerCase().includes(query)) ||
      (entry.location?.name && entry.location.name.toLowerCase().includes(query)) ||
      entry.turns.some((t) => t.content.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  return (
    <aside className="flex h-full flex-col border-r border-white/10 bg-zinc-950/60 backdrop-blur-xl">

      {/* Header controls */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
            <span>Journal History</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
              {entries.length}
            </span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              id="btn-sidebar-export-all"
              onClick={onExportAll}
              title="Export All Entries"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Export All Entries"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              id="btn-sidebar-new-entry"
              onClick={onNewEntry}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            id="input-history-search"
            type="text"
            placeholder="Search entries, locations, insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-amber-400/60 focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition ${
                selectedCategory === cat
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Loading your journal entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-xs font-medium text-zinc-400">No reflections found</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {searchQuery ? 'Try adjusting your search query' : 'Start your first AI reflection!'}
            </p>
            <button
              onClick={onNewEntry}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-300 hover:underline"
            >
              <Plus className="h-3 w-3" /> Create new reflection
            </button>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedEntryId;
            const turnCount = entry.turns.length;
            const formattedDate = new Date(entry.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={entry.id}
                id={`entry-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className={`group relative cursor-pointer rounded-xl border p-3 transition ${
                  isSelected
                    ? 'border-amber-400/50 bg-amber-400/10 shadow-sm ring-1 ring-amber-400/30'
                    : 'border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-200' : 'text-zinc-200'}`}>
                        {entry.title || 'Untitled Reflection'}
                      </h3>
                      {entry.priority === 'urgent' && (
                        <span className="rounded bg-rose-500/20 px-1 text-[9px] font-bold text-rose-300">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete button / confirm */}
                  {confirmDeleteId === entry.id ? (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          onDeleteEntry(entry.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-rose-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(entry.id);
                      }}
                      title="Delete Entry"
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-500 hover:bg-rose-500/20 hover:text-rose-400 transition"
                      aria-label="Delete Entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Location Snippet if pinned */}
                {entry.location && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300/90 font-medium">
                    <MapPin className="h-3 w-3 shrink-0 text-amber-400" />
                    <span className="truncate">{entry.location.name}</span>
                  </div>
                )}

                {/* Snippet / summary preview */}
                <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {entry.summary || (entry.turns[0]?.content) || 'Empty reflection thread...'}
                </p>

                {/* Footer metadata */}
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-zinc-400">
                      <Calendar className="h-3 w-3" />
                      {formattedDate}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400 border border-white/5">
                      {entry.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {entry.notificationStatus?.dispatched && (
                      <span className="text-sky-400" title="Notification Dispatched">
                        <Bell className="h-3 w-3" />
                      </span>
                    )}
                    {entry.summary && (
                      <span className="inline-flex items-center gap-0.5 text-amber-300" title="Distilled Insights Available">
                        <Sparkles className="h-3 w-3" />
                      </span>
                    )}
                    <span className="text-zinc-400 font-medium">
                      {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
}
