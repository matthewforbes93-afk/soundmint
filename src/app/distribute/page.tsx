'use client';

import { useEffect, useState } from 'react';
import { Upload, DollarSign, BarChart3, Music, ExternalLink, Loader2 } from 'lucide-react';
import { Track } from '@/lib/types';
import PublishModal from '@/components/PublishModal';

const platformStats = [
  { name: 'Spotify', color: 'bg-green-500', payout: '$0.003-0.005/stream' },
  { name: 'Apple Music', color: 'bg-gray-400', payout: '$0.007-0.01/stream' },
  { name: 'YouTube Music', color: 'bg-red-500', payout: '$0.002-0.004/stream' },
  { name: 'Amazon Music', color: 'bg-blue-500', payout: '$0.004-0.007/stream' },
  { name: 'TikTok', color: 'bg-pink-500', payout: '$0.002-0.004/use' },
  { name: 'Tidal', color: 'bg-cyan-500', payout: '$0.008-0.012/stream' },
];

export default function DistributePage() {
  const [readyTracks, setReadyTracks] = useState<Track[]>([]);
  const [publishedTracks, setPublishedTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishTrack, setPublishTrack] = useState<Track | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/tracks');
        const data = await res.json();
        if (Array.isArray(data)) {
          setReadyTracks(data.filter((t: Track) => t.status === 'ready'));
          setPublishedTracks(data.filter((t: Track) => t.status === 'published'));
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Upload className="w-6 h-6 text-purple-500" />
          Distribute & Monetize
        </h1>
        <p className="text-gray-400 text-sm mt-1">Publish to streaming platforms and track earnings</p>
      </div>

      {/* Platform Overview */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Supported Platforms</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {platformStats.map(p => (
            <div key={p.name} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${p.color}`} />
              <div>
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="text-xs text-gray-500">{p.payout}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">Requires DistroKid ($22.99/yr) for distribution. <a href="https://distrokid.com" target="_blank" className="text-purple-400 hover:text-purple-300">Sign up</a></p>
      </div>

      {/* Ready to Publish */}
      {readyTracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Ready to Publish ({readyTracks.length})</h2>
          <div className="grid gap-3">
            {readyTracks.map(track => (
              <div key={track.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Music className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{track.title}</p>
                    <p className="text-xs text-gray-500">{track.artist_name} · {track.genre}</p>
                  </div>
                </div>
                <button onClick={() => setPublishTrack(track)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium text-white flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Publish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published */}
      {publishedTracks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Published ({publishedTracks.length})</h2>
          <div className="grid gap-3">
            {publishedTracks.map(track => (
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
                <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Live
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {readyTracks.length === 0 && publishedTracks.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No tracks ready for distribution. Generate some in the AI Playground first.</p>
        </div>
      )}

      {publishTrack && (
        <PublishModal track={publishTrack} onClose={() => setPublishTrack(null)} onPublished={() => {
          setPublishTrack(null);
          setReadyTracks(prev => prev.filter(t => t.id !== publishTrack.id));
          setPublishedTracks(prev => [...prev, { ...publishTrack, status: 'published' }]);
        }} />
      )}
    </div>
  );
}
