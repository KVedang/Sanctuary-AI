import React, { useState } from 'react';
import { 
  Download, 
  Trash2, 
  ShieldAlert, 
  FileJson, 
  FileText, 
  FileSpreadsheet, 
  Check, 
  Loader2,
  Lock,
  UserCheck
} from 'lucide-react';
import { JournalEntry, Goal } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface SettingsViewProps {
  entries: JournalEntry[];
  goals: Goal[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ entries, goals }) => {
  const { profile, updateSettings, deleteUserAccountData } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [confirmPurgeText, setConfirmPurgeText] = useState('');
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const handleExport = (format: 'json' | 'markdown' | 'csv') => {
    setDownloading(format);
    const dateStr = new Date().toISOString().split('T')[0];

    try {
      let content = '';
      let mimeType = 'text/plain';
      let fileName = `my-journal-export-${dateStr}`;

      if (format === 'json') {
        const payload = {
          exportDate: new Date().toISOString(),
          user: profile?.email,
          totalEntries: entries.length,
          totalGoals: goals.length,
          journals: entries,
          goals: goals,
        };
        content = JSON.stringify(payload, null, 2);
        mimeType = 'application/json';
        fileName += '.json';
      } else if (format === 'markdown') {
        content = `# Private Journal Export — ${dateStr}\n\n`;
        content += `Exported for: ${profile?.email}\n\n`;
        content += `## Journal Entries (${entries.length})\n\n`;

        entries.forEach((e, idx) => {
          content += `### ${idx + 1}. ${e.title || 'Untitled'}\n`;
          content += `- **Date**: ${e.createdAt}\n`;
          content += `- **Mood**: ${e.mood || 'None'}\n`;
          content += `- **Tags**: ${e.tags.join(', ')}\n\n`;
          content += `${e.content}\n\n`;
          if (e.aiSummary) {
            content += `> **AI Summary**: ${e.aiSummary}\n\n`;
          }
          content += `---\n\n`;
        });

        mimeType = 'text/markdown';
        fileName += '.md';
      } else if (format === 'csv') {
        content = 'Title,Date,Mood,Tags,WordCount,Content\n';
        entries.forEach((e) => {
          const cleanTitle = `"${(e.title || '').replace(/"/g, '""')}"`;
          const cleanTags = `"${(e.tags || []).join(';')}"`;
          const cleanContent = `"${(e.content || '').replace(/"/g, '""')}"`;
          content += `${cleanTitle},${e.createdAt},${e.mood || ''},${cleanTags},${e.wordCount},${cleanContent}\n`;
        });
        mimeType = 'text/csv';
        fileName += '.csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setTimeout(() => setDownloading(null), 1000);
    }
  };

  const handlePurge = async () => {
    if (confirmPurgeText !== 'DELETE') return;
    setPurging(true);
    setPurgeError(null);

    try {
      await deleteUserAccountData();
    } catch (err: any) {
      setPurgeError(err?.message || 'Failed to delete account data.');
      setPurging(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-stone-950">
          Privacy &amp; Account Settings
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Full control over your AI reflections, data export, and zero-trace account deletion.
        </p>
      </div>

      {/* Profile & Identity Card */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <h3 className="font-serif font-semibold text-stone-900 text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Authenticated Account</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-stone-400 block font-medium">Name</span>
            <span className="text-stone-800 font-semibold">{profile?.displayName || 'User'}</span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">Email</span>
            <span className="text-stone-800 font-mono">{profile?.email || 'N/A'}</span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">User ID (UID)</span>
            <span className="text-stone-500 font-mono break-all">{profile?.userId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-stone-400 block font-medium">Storage Engine</span>
            <span className="text-stone-800 font-medium">Isolated Cloud Firestore (`users/${profile?.userId?.substring(0, 8)}...`)</span>
          </div>
        </div>
      </div>

      {/* Privacy & AI Preferences */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <h3 className="font-serif font-semibold text-stone-900 text-base flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-500" />
          <span>AI Privacy Controls</span>
        </h3>

        <div className="space-y-3 divide-y divide-stone-100">
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-xs font-semibold text-stone-800">Allow AI Reflection &amp; Summaries</p>
              <p className="text-[11px] text-stone-500">Enable in-editor Gemini AI assistance.</p>
            </div>
            <input
              type="checkbox"
              checked={profile?.settings?.aiAnalysisAllowed ?? true}
              onChange={(e) => updateSettings({ aiAnalysisAllowed: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-xs font-semibold text-stone-800">Historical Context for &quot;Ask My Journal&quot;</p>
              <p className="text-[11px] text-stone-500">Allow search queries to evaluate excerpts from past reflections.</p>
            </div>
            <input
              type="checkbox"
              checked={profile?.settings?.useHistoryForAsk ?? true}
              onChange={(e) => updateSettings({ useHistoryForAsk: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="font-serif font-semibold text-stone-900 text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-stone-600" />
            <span>Export Your Journal Data</span>
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Download your entire reflection archive. No lock-in, complete portability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            id="export-json-btn"
            onClick={() => handleExport('json')}
            disabled={downloading !== null}
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-stone-50 transition flex items-center gap-3 cursor-pointer text-left"
          >
            <FileJson className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-stone-800">JSON Format</p>
              <p className="text-[10px] text-stone-400">Complete raw document structure</p>
            </div>
          </button>

          <button
            id="export-markdown-btn"
            onClick={() => handleExport('markdown')}
            disabled={downloading !== null}
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-stone-50 transition flex items-center gap-3 cursor-pointer text-left"
          >
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-stone-800">Markdown Format</p>
              <p className="text-[10px] text-stone-400">Formatted for Obsidian / Notion</p>
            </div>
          </button>

          <button
            id="export-csv-btn"
            onClick={() => handleExport('csv')}
            disabled={downloading !== null}
            className="p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-stone-50 transition flex items-center gap-3 cursor-pointer text-left"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-stone-800">CSV Spreadsheet</p>
              <p className="text-[10px] text-stone-400">Compatible with Excel / Sheets</p>
            </div>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-200 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif font-semibold text-rose-950 text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Danger Zone: Permanent Account Purge</span>
            </h3>
            <p className="text-xs text-rose-700/80 mt-1 max-w-xl leading-relaxed">
              This action permanently purges all journal entries, conversations, goals, and settings from Firestore. This cannot be undone.
            </p>
          </div>

          <button
            id="open-purge-modal-btn"
            onClick={() => setShowPurgeModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-xs shrink-0"
          >
            Delete Account Data
          </button>
        </div>
      </div>

      {/* Purge Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-stone-200 space-y-4">
            <h3 className="font-serif font-bold text-rose-900 text-lg">
              Confirm Permanent Deletion
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Please type <strong className="font-mono text-rose-600">DELETE</strong> to confirm that you want to permanently erase all reflections and goals.
            </p>

            <input
              type="text"
              value={confirmPurgeText}
              onChange={(e) => setConfirmPurgeText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            {purgeError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded">{purgeError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                id="confirm-purge-btn"
                onClick={handlePurge}
                disabled={confirmPurgeText !== 'DELETE' || purging}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition disabled:opacity-40"
              >
                {purging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{purging ? 'Purging...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
