'use client';

import { useState, useEffect } from 'react';
import { Disc3, Sliders, Library, Upload, ShoppingBag, Settings, Music2, FolderOpen, Plus, ChevronRight } from 'lucide-react';
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
      {/* ═══ TOP BAR — horizontal tabs like DaVinci ═══ */}
      <div className="h-10 bg-[#0c0c0c] border-b border-white/[0.03] flex items-center px-2 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 mr-2">
          <div className="w-5 h-5 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-md flex items-center justify-center">
            <Music2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-gray-400">SoundMint</span>
        </div>

        <div className="w-px h-5 bg-white/[0.05] mr-1" />

        {/* Workspace tabs */}
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

        {/* Settings */}
        <button onClick={() => setWorkspace('settings')}
          className={`p-1.5 rounded-md transition-colors ${workspace === 'settings' ? 'text-white' : 'text-gray-700 hover:text-gray-400'}`}>
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ═══ WORKSPACE — fills remaining space, no reload ═══ */}
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

// ─── Home View (project manager, not marketing) ───
function HomeView({ projects, onNavigate, onRefresh }: {
  projects: ProjectSummary[];
  onNavigate: (w: Workspace) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="h-full flex">
      {/* Left: quick actions */}
      <div className="w-64 border-r border-white/[0.03] p-5 flex flex-col">
        <h2 className="text-xs text-gray-600 uppercase tracking-wider mb-4">Quick Start</h2>
        <button onClick={() => onNavigate('create')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/15 transition-colors mb-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Session
        </button>
        <button onClick={() => onNavigate('studio')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] text-gray-500 hover:text-white transition-colors mb-2 text-sm">
          <Sliders className="w-4 h-4" /> Open Studio
        </button>
        <button onClick={() => onNavigate('library')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] text-gray-500 hover:text-white transition-colors text-sm">
          <Library className="w-4 h-4" /> Browse Library
        </button>

        <div className="flex-1" />
        <p className="text-[9px] text-gray-800">SoundMint v2.0</p>
      </div>

      {/* Right: project list */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Projects</h1>
          <span className="text-xs text-gray-700">{projects.length} total</span>
        </div>

        {projects.length > 0 ? (
          <div className="space-y-px">
            {projects.map(p => (
              <button key={p.id} onClick={() => onNavigate('studio')}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors group text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center">
                    <Music2 className="w-4 h-4 text-gray-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-300 group-hover:text-white transition-colors">{p.title}</p>
                    <p className="text-[11px] text-gray-700">{p.artist} · {p.status} · {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-gray-800 group-hover:text-gray-500 transition-colors" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <FolderOpen className="w-10 h-10 text-gray-900 mx-auto mb-3" />
            <p className="text-sm text-gray-700 mb-4">No projects yet</p>
            <button onClick={() => onNavigate('create')}
              className="text-sm px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-medium transition-colors">
              Create Your First Track
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
