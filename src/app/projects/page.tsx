'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Clock, Music, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Track } from '@/lib/types';

export default function ProjectsPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/tracks');
        const data = await res.json();
        if (Array.isArray(data)) setTracks(data);
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const wip = tracks.filter(t => t.status === 'ready' || t.status === 'generating');
  const published = tracks.filter(t => t.status === 'published');
  const failed = tracks.filter(t => t.status === 'failed');

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-purple-500" />
            Projects
          </h1>
          <p className="text-gray-400 text-sm mt-1">{tracks.length} total tracks</p>
        </div>
        <Link href="/playground" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Track
        </Link>
      </div>

      {/* Status Groups */}
      {wip.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> In Progress ({wip.length})
          </h2>
          <div className="grid gap-3">
            {wip.map(track => (
              <div key={track.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <Music className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{track.title}</p>
                    <p className="text-xs text-gray-500">{track.artist_name} · {track.genre} · {track.mood}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href="/studio" className="text-xs px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20">Open in Studio</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {published.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3">Published ({published.length})</h2>
          <div className="grid gap-3">
            {published.map(track => (
              <div key={track.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <Music className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{track.title}</p>
                    <p className="text-xs text-gray-500">{track.artist_name} · {track.genre}</p>
                  </div>
                </div>
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">Live</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tracks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No projects yet</p>
          <Link href="/playground" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white">
            Create Your First Track
          </Link>
        </div>
      )}
    </div>
  );
}
