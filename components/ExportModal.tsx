'use client';

import React, { useState } from 'react';
import { X, Copy, Download, Check, FileText, Code2 } from 'lucide-react';
import { JournalEntry } from '@/lib/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  currentEntry?: JournalEntry | null;
}

export function ExportModal({
  isOpen,
  onClose,
  entries,
  currentEntry,
}: ExportModalProps) {
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json'>('markdown');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const targetEntries =
    exportScope === 'current' && currentEntry
      ? [currentEntry]
      : entries;

  const generateMarkdown = (list: JournalEntry[]): string => {
    return list
      .map((e) => {
        let md = `# ${e.title || 'Untitled Reflection'}\n`;
        md += `**Date:** ${new Date(e.createdAt).toLocaleString()} | **Category:** ${e.category}${e.mood ? ` | **Mood:** ${e.mood}` : ''}\n\n`;

        if (e.summary) {
          md += `## Executive Summary\n${e.summary}\n\n`;
        }

        if (e.keyInsights && e.keyInsights.length > 0) {
          md += `## Key Insights & Realizations\n`;
          e.keyInsights.forEach((insight) => {
            md += `- ${insight}\n`;
          });
          md += `\n`;
        }

        if (e.actionItems && e.actionItems.length > 0) {
          md += `## Recommended Action Items\n`;
          e.actionItems.forEach((action) => {
            md += `- [ ] ${action}\n`;
          });
          md += `\n`;
        }

        md += `## Multi-Turn Dialogue\n\n`;
        e.turns.forEach((turn, idx) => {
          const speaker = turn.role === 'user' ? '### 👤 You' : '### ✨ Gemini (AI Reflection Partner)';
          md += `${speaker} (${new Date(turn.timestamp).toLocaleTimeString()})\n\n${turn.content}\n\n---\n\n`;
        });

        return md;
      })
      .join('\n\n========================================\n\n');
  };

  const getExportContent = (): string => {
    if (exportFormat === 'json') {
      return JSON.stringify(targetEntries, null, 2);
    }
    return generateMarkdown(targetEntries);
  };

  const handleCopy = async () => {
    const text = getExportContent();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getExportContent();
    const extension = exportFormat === 'json' ? 'json' : 'md';
    const mimeType = exportFormat === 'json' ? 'application/json' : 'text/markdown';
    const filename = `gemini-reflections-${exportScope}-${new Date().toISOString().slice(0, 10)}.${extension}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div
        id="export-modal-container"
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-zinc-200 border border-white/10">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Export Journal Entries
              </h3>
              <p className="text-xs text-zinc-400">
                Download your reflection archives with full multi-turn context
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Options */}
        <div className="mt-4 space-y-4">
          {/* Scope selection */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Export Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('current')}
                disabled={!currentEntry}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  exportScope === 'current'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                } ${!currentEntry ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Current Reflection Only
              </button>
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  exportScope === 'all'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                All Entries ({entries.length})
              </button>
            </div>
          </div>

          {/* Format selection */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('markdown')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  exportFormat === 'markdown'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  exportFormat === 'json'
                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Code2 className="h-4 w-4" />
                <span>JSON (.json)</span>
              </button>
            </div>
          </div>

          {/* Content Preview */}
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Preview
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/90 p-3 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap">
              {getExportContent().slice(0, 1000)}
              {getExportContent().length > 1000 && '\n... (truncated for preview)'}
            </div>
          </div>
        </div>

        {/* Modal actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            id="btn-export-copy"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                <span>Copy to Clipboard</span>
              </>
            )}
          </button>
          <button
            id="btn-export-download"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition"
          >
            <Download className="h-3.5 w-3.5 text-amber-600" />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
}
