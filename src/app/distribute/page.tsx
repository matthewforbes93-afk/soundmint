'use client';

import { useEffect, useState } from 'react';
import { Upload, Globe, CheckCircle2, Clock, Music2 } from 'lucide-react';

interface ProjectItem { id: string; title: string; artist: string; status: string; }

const platforms = [
  { name: 'Spotify', color: '#1DB954', payout: '$0.003-0.005' },
  { name: 'Apple Music', color: '#FA243C', payout: '$0.007-0.01' },
  { name: 'YouTube Music', color: '#FF0000', payout: '$0.002-0.004' },
  { name: 'Amazon Music', color: '#00A8E1', payout: '$0.004-0.007' },
  { name: 'TikTok', color: '#FF004F', payout: '$0.002-0.004' },
  { name: 'Tidal', color: '#000000', payout: '$0.008-0.012' },
];

export default function DistributePage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProjects(d);
    }).catch(() => {});
  }, []);

  return (
    <div className="h-full flex">
      {/* Left: platform list */}
      <div className="w-72 border-r border-white/[0.03] p-5">
        <h2 className="text-xs text-gray-600 uppercase tracking-wider mb-4">Platforms</h2>
        <div className="space-y-1">
          {platforms.map(p => (
            <div key={p.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                <span className="text-sm text-gray-300">{p.name}</span>
              </div>
              <span className="text-[10px] text-gray-700">{p.payout}/stream</span>
            </div>
          ))}
        </div>

        <div className="mt-6 p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
          <p className="text-[10px] text-gray-600 mb-1">Distribution via</p>
          <p className="text-sm text-white font-medium">DistroKid</p>
          <p className="text-[10px] text-gray-700 mt-1">$22.99/yr · unlimited uploads</p>
        </div>
      </div>

      {/* Right: ready to publish */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Distribute</h1>
          <div className="flex items-center gap-2 text-xs text-gray-700">
            <Globe className="w-3 h-3" /> One-click publishing
          </div>
        </div>

        {projects.length > 0 ? (
          <div className="space-y-1">
            {projects.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center">
                    <Music2 className="w-4 h-4 text-gray-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-300">{p.title}</p>
                    <p className="text-[11px] text-gray-700">{p.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.status === 'published' ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-500"><CheckCircle2 className="w-3 h-3" /> Live</span>
                  ) : (
                    <button className="text-[11px] px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Upload className="w-10 h-10 text-gray-900 mx-auto mb-3" />
            <p className="text-sm text-gray-700">No projects to distribute</p>
          </div>
        )}
      </div>
    </div>
  );
}
