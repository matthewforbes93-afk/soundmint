'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Library, Search, Trash2, Sliders, Plus, LayoutGrid, LayoutList, Play, ChevronDown, Music2, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectItem {
  id: string;
  title: string;
  artist: string;
  status: string;
  genre?: string;
  updated_at: string;
  created_at: string;
}

const GENRE_COLORS: Record<string, string> = {
  'hip-hop': '#a855f7',
  'hip hop': '#a855f7',
  rap: '#a855f7',
  pop: '#ec4899',
  rock: '#ef4444',
  electronic: '#06b6d4',
  edm: '#06b6d4',
  jazz: '#f59e0b',
  rnb: '#8b5cf6',
  'r&b': '#8b5cf6',
  classical: '#6366f1',
  country: '#d97706',
  reggae: '#22c55e',
  latin: '#f97316',
  soul: '#c084fc',
  funk: '#fb923c',
  blues: '#3b82f6',
  metal: '#64748b',
  folk: '#a3e635',
  ambient: '#2dd4bf',
  'lo-fi': '#94a3b8',
  trap: '#e879f9',
};

function getGenreColor(genre?: string): string {
  if (!genre) return '#525252';
  return GENRE_COLORS[genre.toLowerCase()] || '#525252';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type SortBy = 'updated' | 'created' | 'title';
type StatusFilter = 'all' | 'draft' | 'published';
type ViewMode = 'grid' | 'list';

export default function LibraryPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProjects(d);
    }).finally(() => setLoading(false));
  }, []);

  async function deleteProject(id: string) {
    if (!confirm('Delete this project?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects(p => p.filter(x => x.id !== id));
      toast.success('Deleted');
    }
  }

  const filtered = useMemo(() => {
    let result = projects;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.artist.toLowerCase().includes(q) ||
        (p.genre && p.genre.toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return result;
  }, [projects, search, sortBy, statusFilter]);

  const drafts = projects.filter(p => p.status === 'draft').length;
  const published = projects.filter(p => p.status === 'published').length;

  return (
    <div className="h-full bg-[#111] text-white">
      {/* Toolbar */}
      <div className="border-b border-white/[0.03] bg-[#0c0c0c]">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-3">
          {/* Title + count */}
          <div className="flex items-center gap-3 mr-4">
            <Library className="w-4 h-4 text-gray-500" />
            <h1 className="text-sm font-semibold">Library</h1>
            <span className="text-[10px] text-gray-700 bg-white/[0.03] px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-white/[0.03] border border-white/[0.04] rounded-md pl-8 pr-3 py-1.5 text-[11px] text-white placeholder:text-gray-700 focus:outline-none focus:border-white/10"
            />
          </div>

          <div className="flex-1" />

          {/* Status filter tabs */}
          <div className="flex items-center bg-white/[0.02] rounded-md border border-white/[0.04] p-0.5">
            {([
              ['all', `All (${projects.length})`],
              ['draft', `Drafts (${drafts})`],
              ['published', `Published (${published})`],
            ] as [StatusFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`text-[10px] px-2.5 py-1 rounded font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-white/[0.06] text-white'
                    : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 px-2.5 py-1.5 rounded-md border border-white/[0.04] bg-white/[0.02] transition-colors"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'updated' ? 'Last Modified' : sortBy === 'created' ? 'Date Created' : 'Title'}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-white/[0.06] rounded-lg shadow-xl py-1 min-w-[140px]">
                  {([
                    ['updated', 'Last Modified'],
                    ['created', 'Date Created'],
                    ['title', 'Title'],
                  ] as [SortBy, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => { setSortBy(value); setShowSortMenu(false); }}
                      className={`w-full text-left text-[11px] px-3 py-1.5 transition-colors ${
                        sortBy === value ? 'text-white bg-white/[0.04]' : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/[0.02] rounded-md border border-white/[0.04] p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'text-gray-300 bg-white/[0.05]' : 'text-gray-700 hover:text-gray-400'}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'text-gray-300 bg-white/[0.05]' : 'text-gray-700 hover:text-gray-400'}`}>
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New */}
          <Link href="/session"
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-medium transition-colors">
            <Plus className="w-3 h-3" /> New
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-5 overflow-auto" style={{ maxHeight: 'calc(100vh - 52px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-5 h-5 border-2 border-gray-800 border-t-gray-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          viewMode === 'grid' ? (
            /* ── GRID VIEW ── */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map(p => (
                <div
                  key={p.id}
                  className="group relative rounded-lg bg-white/[0.015] border border-white/[0.04] hover:border-white/[0.08] transition-all overflow-hidden"
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Genre accent strip */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: getGenreColor(p.genre) }}
                  />

                  {/* Cover area */}
                  <div className="relative aspect-square bg-white/[0.01] flex items-center justify-center m-2.5 mb-0 rounded-md overflow-hidden">
                    <Music2 className="w-8 h-8 text-gray-800" />

                    {/* Hover overlay */}
                    <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 transition-opacity ${
                      hoveredId === p.id ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </button>
                      <div className="flex gap-1">
                        <Link href={`/studio?project=${p.id}`}
                          className="text-[9px] px-2 py-1 rounded bg-teal-600/80 hover:bg-teal-600 text-white font-medium transition-colors flex items-center gap-1">
                          <Sliders className="w-2.5 h-2.5" /> Studio
                        </Link>
                        <button onClick={() => deleteProject(p.id)}
                          className="text-[9px] px-2 py-1 rounded bg-white/10 hover:bg-red-600/60 text-gray-300 hover:text-white font-medium transition-colors flex items-center gap-1">
                          <Trash2 className="w-2.5 h-2.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 pt-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[11px] text-gray-200 font-medium truncate flex-1">{p.title}</p>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-1.5 ${
                        p.status === 'published' ? 'bg-emerald-400' : 'bg-yellow-400'
                      }`} />
                    </div>
                    <p className="text-[10px] text-gray-600 truncate">{p.artist}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      {p.genre ? (
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: getGenreColor(p.genre) + '18', color: getGenreColor(p.genre) }}
                        >
                          {p.genre}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-[9px] text-gray-800">{formatRelativeDate(p.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── LIST VIEW ── */
            <div>
              {/* Table header */}
              <div className="flex items-center px-4 py-2 text-[10px] text-gray-700 uppercase tracking-wider border-b border-white/[0.03]">
                <span className="w-5" />
                <span className="flex-1 min-w-0">Title</span>
                <span className="w-32">Artist</span>
                <span className="w-24">Genre</span>
                <span className="w-20">Status</span>
                <span className="w-28">Modified</span>
                <span className="w-24" />
              </div>

              {filtered.map(p => (
                <div
                  key={p.id}
                  className="group flex items-center px-4 py-2 hover:bg-white/[0.02] transition-colors border-b border-white/[0.015]"
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Status dot */}
                  <div className="w-5 flex-shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      p.status === 'published' ? 'bg-emerald-400' : 'bg-yellow-400'
                    }`} />
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] text-gray-200 font-medium truncate block">{p.title}</span>
                  </div>

                  {/* Artist */}
                  <span className="w-32 text-[11px] text-gray-500 truncate">{p.artist}</span>

                  {/* Genre */}
                  <div className="w-24">
                    {p.genre ? (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: getGenreColor(p.genre) + '18', color: getGenreColor(p.genre) }}
                      >
                        {p.genre}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-800">--</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="w-20">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  {/* Date */}
                  <span className="w-28 text-[11px] text-gray-600">{formatRelativeDate(p.updated_at)}</span>

                  {/* Actions */}
                  <div className={`w-24 flex gap-1 justify-end transition-opacity ${
                    hoveredId === p.id ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <button className="p-1.5 rounded hover:bg-white/[0.05] text-gray-600 hover:text-white transition-colors">
                      <Play className="w-3 h-3" />
                    </button>
                    <Link href={`/studio?project=${p.id}`}
                      className="p-1.5 rounded hover:bg-white/[0.05] text-gray-600 hover:text-teal-400 transition-colors">
                      <Sliders className="w-3 h-3" />
                    </Link>
                    <button onClick={() => deleteProject(p.id)}
                      className="p-1.5 rounded hover:bg-white/[0.05] text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
              <Library className="w-6 h-6 text-gray-800" />
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {search ? 'No matching projects' : statusFilter !== 'all' ? `No ${statusFilter} projects` : 'No projects yet'}
            </p>
            <p className="text-[11px] text-gray-800 mb-5">
              {search ? 'Try a different search term' : 'Create a session to get started'}
            </p>
            {!search && (
              <Link href="/session"
                className="flex items-center gap-2 text-xs px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> New Session
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
