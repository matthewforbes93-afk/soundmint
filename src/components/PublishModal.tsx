'use client';

import { useState } from 'react';
import { Track, DistributionPlatform } from '@/lib/types';
import { X, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const platforms: { value: DistributionPlatform; label: string }[] = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'amazon_music', label: 'Amazon Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'deezer', label: 'Deezer' },
  { value: 'tidal', label: 'Tidal' },
];

interface PublishModalProps {
  track: Track;
  onClose: () => void;
  onPublished: () => void;
}

export default function PublishModal({ track, onClose, onPublished }: PublishModalProps) {
  const [selected, setSelected] = useState<DistributionPlatform[]>(
    ['spotify', 'apple_music', 'youtube_music']
  );
  const [loading, setLoading] = useState(false);

  function togglePlatform(platform: DistributionPlatform) {
    setSelected((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  async function handlePublish() {
    if (!selected.length) return toast.error('Select at least one platform');
    setLoading(true);
    try {
      const res = await fetch(`/api/tracks/${track.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success('Track submitted for publishing!');
      onPublished();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publishing failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Publish Track</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-gray-800/50 rounded-lg p-3 mb-5">
            <p className="font-medium text-white">{track.title}</p>
            <p className="text-sm text-gray-400">{track.artist_name} · {track.genre} · {track.mood}</p>
          </div>

          <p className="text-sm text-gray-300 mb-3">Select platforms:</p>
          <div className="space-y-2">
            {platforms.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => togglePlatform(value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  selected.includes(value)
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={loading || !selected.length}
            className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
