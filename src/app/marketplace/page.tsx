'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Play, Pause, Tag, DollarSign, TrendingUp } from 'lucide-react';

interface ListingItem {
  id: string;
  title: string;
  artist: string;
  genre: string;
  audioUrl: string | null;
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tracks').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setListings(d.filter((t: { audio_url: string; status: string }) => t.audio_url && t.status === 'ready').slice(0, 20).map((t: { id: string; title: string; artist_name: string; genre: string; audio_url: string }) => ({
          id: t.id, title: t.title, artist: t.artist_name, genre: t.genre, audioUrl: t.audio_url
        })));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="h-full flex">
      <div className="w-64 border-r border-white/[0.03] p-5">
        <h2 className="text-xs text-gray-600 uppercase tracking-wider mb-4">Overview</h2>
        {[
          { label: 'Listings', value: listings.length, icon: Tag },
          { label: 'Revenue', value: '$0.00', icon: DollarSign },
          { label: 'Plays', value: '0', icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.02] mb-1">
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <span className="text-sm text-white font-medium">{String(value)}</span>
          </div>
        ))}

        <div className="mt-6">
          <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3">License Tiers</h3>
          {[
            { name: 'Lease', price: '$29.99', desc: 'MP3, 5K streams' },
            { name: 'Premium', price: '$79.99', desc: 'WAV + stems' },
            { name: 'Exclusive', price: '$299.99', desc: 'Full ownership' },
          ].map(l => (
            <div key={l.name} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03] mb-1">
              <div className="flex justify-between">
                <span className="text-xs text-gray-300">{l.name}</span>
                <span className="text-xs text-teal-400">{l.price}</span>
              </div>
              <p className="text-[9px] text-gray-700">{l.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">Marketplace</h1>
          <span className="text-xs text-gray-700">{listings.length} beats</span>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {listings.map(item => (
              <div key={item.id} className="bg-white/[0.02] border border-white/[0.03] rounded-xl overflow-hidden hover:border-white/[0.06] transition-colors group">
                <div className="h-24 bg-gradient-to-br from-teal-900/10 to-purple-900/10 flex items-center justify-center relative">
                  {item.audioUrl && (
                    <button onClick={() => setPlayingId(playingId === item.id ? null : item.id)}
                      className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                      {playingId === item.id ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                    </button>
                  )}
                  <span className="absolute bottom-2 left-2 text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300">{item.genre}</span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="text-[11px] text-gray-700">{item.artist}</p>
                  <div className="flex gap-1 mt-2">
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">$29.99</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">$79.99</span>
                  </div>
                </div>
                {playingId === item.id && item.audioUrl && <audio src={item.audioUrl} autoPlay onEnded={() => setPlayingId(null)} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <ShoppingBag className="w-10 h-10 text-gray-900 mx-auto mb-3" />
            <p className="text-sm text-gray-700">No beats listed</p>
          </div>
        )}
      </div>
    </div>
  );
}
