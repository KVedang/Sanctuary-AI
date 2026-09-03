import React, { useState } from 'react';
import { 
  Search, 
  Star, 
  Pin, 
  Archive, 
  Calendar, 
  Tag as TagIcon, 
  ArrowUpDown, 
  Clock,
  Filter
} from 'lucide-react';
import { JournalEntry } from '../../types';
import { formatDate, formatRelativeTime } from '../../lib/utils';

interface HistoryListProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onNewReflection: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  entries,
  onSelectEntry,
  onNewReflection,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'pinned' | 'archived'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Extract all unique tags
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags || []))
  ).filter(Boolean);

  // Apply filters
  const filtered = entries.filter((entry) => {
    // Filter mode
    if (filterMode === 'favorites' && !entry.isFavorite) return false;
    if (filterMode === 'pinned' && !entry.isPinned) return false;
    if (filterMode === 'archived' && !entry.isArchived) return false;
    if (filterMode !== 'archived' && entry.isArchived) return false;

    // Tag filter
    if (selectedTag && !entry.tags.includes(selectedTag)) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (entry.title || '').toLowerCase().includes(q);
      const matchContent = (entry.content || '').toLowerCase().includes(q);
      const matchTag = entry.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTag) return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-stone-950">
            Journal History &amp; Archive
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Search, filter, and review all previous reflections. Isolated to your private UID.
          </p>
        </div>

        <button
          onClick={onNewReflection}
          className="px-4 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-xl text-xs font-medium transition cursor-pointer self-start sm:self-auto shadow-xs"
        >
          + New Reflection
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, contents, or keywords..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'all'
                  ? 'bg-stone-900 text-stone-50'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All ({entries.filter((e) => !e.isArchived).length})
            </button>

            <button
              onClick={() => setFilterMode('favorites')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
                filterMode === 'favorites'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Star className="w-3 h-3 fill-current text-amber-500" />
              <span>Favorites</span>
            </button>

            <button
              onClick={() => setFilterMode('pinned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
                filterMode === 'pinned'
                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Pin className="w-3 h-3 text-blue-500" />
              <span>Pinned</span>
            </button>

            <button
              onClick={() => setFilterMode('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
                filterMode === 'archived'
                  ? 'bg-stone-800 text-stone-100'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>Archived</span>
            </button>

            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="p-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition cursor-pointer shrink-0"
              title={`Sort by: ${sortOrder}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100 text-xs">
            <span className="text-stone-400 text-[11px] font-medium mr-1">Filter by Tag:</span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="px-2 py-0.5 rounded-full bg-stone-900 text-stone-50 text-[10px] cursor-pointer"
              >
                Clear Tag &times;
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-full text-[11px] transition cursor-pointer ${
                  selectedTag === tag
                    ? 'bg-amber-200 text-amber-900 font-medium'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entry Cards List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <p className="text-sm font-medium text-stone-700">No reflections found</p>
          <p className="text-xs text-stone-400 mt-1">Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              onClick={() => onSelectEntry(entry)}
              className="p-5 rounded-2xl bg-white border border-stone-200/80 hover:border-amber-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between gap-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.isPinned && <Pin className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    {entry.isFavorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-current shrink-0" />}
                    <h3 className="font-serif font-semibold text-stone-900 text-base group-hover:text-amber-800 transition truncate">
                      {entry.title || 'Untitled Reflection'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-stone-400 shrink-0">
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>

                <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed font-sans">
                  {entry.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
                <div className="flex items-center gap-1 flex-wrap">
                  {entry.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <span className="text-stone-400">
                  {entry.wordCount} words
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
