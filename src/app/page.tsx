'use client';

import { useState, useEffect, useMemo } from 'react';
import { Disc3, Sliders, Library, Upload, ShoppingBag, Settings, Music2, FolderOpen, Plus, ChevronRight, Search, LayoutGrid, LayoutList, Clock, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy load workspaces — no page navigation, just tab switch
const SessionWorkspace = dynamic(() => import('@/components/workspaces/SessionWorkspace'), { ssr: false });
const StudioWorkspace = dynamic(() => import('@/components/workspaces/StudioWorkspace'), { ssr: false });
const LibraryWorkspace = dynamic(() => import('@/components/workspaces/LibraryWorkspace'), { ssr: false });
const DistributeWorkspace = dynamic(() => import('@/components/workspaces/DistributeWorkspace'), { ssr: false });
const MarketplaceWorkspace = dynamic(() => import('@/components/workspaces/MarketplaceWorkspace'), { ssr: false });
const SettingsWorkspace = dynamic(() => import('@/components/workspaces/SettingsWorkspace'), { ssr: false });

type Workspace = 'home' | 'create' | 'studio' | 'library' | 'distribute' | 'marketplace' | 'settings';

const tabs: { id: Workspace; label: string; icon: typeof Disc3 }[] = [
  { id: 'home', label: 'Home', icon: FolderOpen },
  { id: 'create', label: 'Create', icon: Disc3 },
  { id: 'studio', label: 'Studio', icon: Sliders },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'distribute', label: 'Distribute', icon: Upload },
  { id: 'marketplace', label: 'Market', icon: ShoppingBag },
];

interface ProjectSummary {
  id: string;
  title: string;
  artist: string;
  status: string;
  updated_at: string;
  created_at: string;
  genre?: string;
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

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>('home');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProjects(d);
    }).catch(() => {});
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#111] text-white overflow-hidden">
      {/* TOP BAR */}
      <div className="h-10 bg-[#0c0c0c] border-b border-white/[0.03] flex items-center px-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 mr-2">
          <div className="w-5 h-5 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-md flex items-center justify-center">
            <Music2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-400">SoundMint</span>
        </div>

        <div className="w-px h-5 bg-white/[0.05] mr-1" />

        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setWorkspace(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all rounded-md mx-0.5 ${
              workspace === id
                ? 'bg-white/[0.06] text-white'
                : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <button onClick={() => setWorkspace('settings')}
          className={`p-1.5 rounded-md transition-colors ${workspace === 'settings' ? 'text-white' : 'text-gray-700 hover:text-gray-400'}`}>
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 overflow-hidden">
        {workspace === 'home' && (
          <HomeView projects={projects} onNavigate={setWorkspace} onRefresh={() => {
            fetch('/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setProjects(d); });
          }} />
        )}
        {workspace === 'create' && <SessionWorkspace />}
        {workspace === 'studio' && <StudioWorkspace />}
        {workspace === 'library' && <LibraryWorkspace />}
        {workspace === 'distribute' && <DistributeWorkspace />}
        {workspace === 'marketplace' && <MarketplaceWorkspace />}
        {workspace === 'settings' && <SettingsWorkspace />}
      </div>
    </div>
  );
}

// ─── Home View — Project Manager ───
function HomeView({ projects, onNavigate, onRefresh }: {
  projects: ProjectSummary[];
  onNavigate: (w: Workspace) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filtered = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.artist.toLowerCase().includes(q) ||
      (p.genre && p.genre.toLowerCase().includes(q))
    );
  }, [projects, search]);

  const selected = useMemo(() =>
    filtered.find(p => p.id === selectedId) || null
  , [filtered, selectedId]);

  const drafts = projects.filter(p => p.status === 'draft').length;
  const published = projects.filter(p => p.status === 'published').length;

  return (
    <div className="h-full flex">
      {/* ── LEFT PANEL: Project List ── */}
      <div className="w-80 bg-[#0c0c0c] border-r border-white/[0.03] flex flex-col flex-shrink-0">
        {/* New Session + View Toggle */}
        <div className="p-3 border-b border-white/[0.03]">
          <button onClick={() => onNavigate('create')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-white/[0.03]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-700" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-white/[0.03] border border-white/[0.04] rounded-md pl-8 pr-3 py-1.5 text-[11px] text-white placeholder:text-gray-700 focus:outline-none focus:border-white/10"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-3 py-2 border-b border-white/[0.03] flex items-center gap-3">
          <span className="text-[10px] text-gray-600">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'text-gray-300 bg-white/[0.04]' : 'text-gray-700 hover:text-gray-400'}`}>
              <LayoutList className="w-3 h-3" />
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'text-gray-300 bg-white/[0.04]' : 'text-gray-700 hover:text-gray-400'}`}>
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length > 0 ? (
            viewMode === 'list' ? (
              <div className="py-1">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      selectedId === p.id
                        ? 'bg-white/[0.05]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Status dot */}
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      p.status === 'published' ? 'bg-emerald-400' : 'bg-yellow-400'
                    }`} />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-gray-200 truncate font-medium">{p.title}</span>
                        {p.genre && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{ backgroundColor: getGenreColor(p.genre) + '20', color: getGenreColor(p.genre) }}
                          >
                            {p.genre}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600 truncate">{p.artist}</span>
                        <span className="text-[10px] text-gray-800">·</span>
                        <span className="text-[10px] text-gray-700">{formatRelativeDate(p.updated_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-800 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 grid grid-cols-2 gap-2">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`rounded-lg p-2.5 text-left transition-colors border ${
                      selectedId === p.id
                        ? 'bg-white/[0.04] border-white/[0.08]'
                        : 'bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="w-full aspect-square rounded bg-white/[0.02] flex items-center justify-center mb-2">
                      <Music2 className="w-5 h-5 text-gray-800" />
                    </div>
                    <p className="text-[11px] text-gray-200 font-medium truncate">{p.title}</p>
                    <p className="text-[9px] text-gray-700 truncate mt-0.5">{p.artist}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className={`w-1 h-1 rounded-full ${
                        p.status === 'published' ? 'bg-emerald-400' : 'bg-yellow-400'
                      }`} />
                      <span className="text-[9px] text-gray-700">{p.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <FolderOpen className="w-6 h-6 text-gray-800 mb-2" />
              <p className="text-[11px] text-gray-700">
                {search ? 'No matching projects' : 'No projects yet'}
              </p>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-3 py-2 border-t border-white/[0.03] flex items-center gap-3 text-[9px] text-gray-700">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
            {drafts} draft{drafts !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {published} published
          </span>
          <div className="flex-1" />
          <span>SoundMint v2.0</span>
        </div>
      </div>

      {/* ── MAIN AREA: Selected Project Preview ── */}
      <div className="flex-1 flex items-center justify-center overflow-auto bg-[#111]">
        {selected ? (
          <div className="max-w-lg w-full px-8">
            {/* Project Preview */}
            <div className="mb-8">
              {/* Cover art placeholder */}
              <div className="w-32 h-32 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-6">
                <Music2 className="w-10 h-10 text-gray-800" />
              </div>

              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{selected.title}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  selected.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {selected.status}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-4">{selected.artist}</p>

              {selected.genre && (
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full font-medium inline-block mb-4"
                  style={{ backgroundColor: getGenreColor(selected.genre) + '15', color: getGenreColor(selected.genre) }}
                >
                  {selected.genre}
                </span>
              )}

              <div className="flex items-center gap-4 text-[11px] text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Created {new Date(selected.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Modified {formatRelativeDate(selected.updated_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('studio')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
              >
                <Sliders className="w-4 h-4" />
                Open in Studio
              </button>
              <button
                onClick={() => onNavigate('distribute')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-gray-300 text-sm font-medium transition-colors border border-white/[0.05]"
              >
                <Upload className="w-4 h-4" />
                Distribute
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mx-auto mb-5">
              <Plus className="w-8 h-8 text-gray-800" />
            </div>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">
              {projects.length > 0 ? 'Select a project' : 'Start your first session'}
            </h2>
            <p className="text-sm text-gray-700 mb-6 max-w-xs mx-auto">
              {projects.length > 0
                ? 'Choose a project from the sidebar to preview or edit it.'
                : 'Create a new session to start producing.'}
            </p>
            <button
              onClick={() => onNavigate('create')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors mx-auto"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
