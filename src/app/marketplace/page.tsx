'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, DollarSign, Tag, Play, Pause, Upload, Filter, TrendingUp } from 'lucide-react';
import { Track } from '@/lib/types';

const LICENSE_TYPES = [
  { name: 'Lease', price: 29.99, desc: 'Non-exclusive, MP3, up to 5,000 streams' },
  { name: 'Premium', price: 79.99, desc: 'Non-exclusive, WAV + stems, unlimited streams' },
  { name: 'Exclusive', price: 299.99, desc: 'Full ownership, all files, exclusive rights' },
];

export default function MarketplacePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [listingTrack, setListingTrack] = useState<Track | null>(null);
  const [listPrice, setListPrice] = useState(29.99);

  useEffect(() => {
    fetch('/api/tracks').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setTracks(data.filter((t: Track) => t.status === 'ready' && t.audio_url));
    }).finally(() => setLoading(false));
  }, []);

  function togglePlay(id: string) {
    setPlayingId(playingId === id ? null : id);
  }

  const genres = ['all', ...new Set(tracks.map(t => t.genre))];

  const filtered = filter === 'all' ? tracks : tracks.filter(t => t.genre === filter);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-teal-500" />
          Marketplace
        </h1>
        <p className="text-gray-400 text-sm mt-1">Sell your beats, buy sounds, license tracks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Your Listings', value: tracks.length, icon: Tag, color: 'teal' },
          { label: 'Total Sales', value: '$0.00', icon: DollarSign, color: 'green' },
          { label: 'Views', value: '0', icon: TrendingUp, color: 'blue' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xl font-bold text-white mt-1">{value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {genres.map(g => (
          <button key={g} onClick={() => setFilter(g)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium ${filter === g ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            {g === 'all' ? 'All' : g}
          </button>
        ))}
      </div>

      {/* Beat grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(track => (
          <div key={track.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group hover:border-gray-700 transition-colors">
            {/* Cover */}
            <div className="h-32 bg-gradient-to-br from-teal-900/20 to-purple-900/20 flex items-center justify-center relative">
              <button onClick={() => togglePlay(track.id)}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full flex items-center justify-center transition-all">
                {playingId === track.id ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </button>
              <div className="absolute bottom-2 left-2 flex gap-1">
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white">{track.genre}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-white">{track.mood}</span>
              </div>
            </div>
            {/* Info */}
            <div className="p-3">
              <h3 className="font-semibold text-white text-sm">{track.title}</h3>
              <p className="text-[11px] text-gray-500">{track.artist_name}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1">
                  {LICENSE_TYPES.slice(0, 2).map(l => (
                    <span key={l.name} className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">
                      {l.name} ${l.price}
                    </span>
                  ))}
                </div>
                <button onClick={() => setListingTrack(track)}
                  className="text-[9px] px-2 py-1 bg-teal-600 hover:bg-teal-700 rounded text-white font-medium">
                  List
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tracks.length === 0 && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No beats to sell yet</p>
          <p className="text-xs text-gray-600">Generate or record tracks in the Studio, then list them here</p>
        </div>
      )}

      {/* Audio elements for playback */}
      {tracks.map(t => t.audio_url && playingId === t.id && (
        <audio key={t.id} src={t.audio_url} autoPlay onEnded={() => setPlayingId(null)} />
      ))}
    </div>
  );
}
