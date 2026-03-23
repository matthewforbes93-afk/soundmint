'use client';

import { useEffect, useState } from 'react';
import GenerationForm from '@/components/GenerationForm';
import TrackCard from '@/components/TrackCard';
import { Track } from '@/lib/types';
import { Wand2 } from 'lucide-react';

export default function GeneratePage() {
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  async function loadTracks() {
    try {
      const res = await fetch('/api/tracks');
      const data = await res.json();
      if (Array.isArray(data)) setRecentTracks(data.slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => { loadTracks(); }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-purple-500" />
          Generate Track
        </h1>
        <p className="text-gray-400 text-sm mt-1">Create AI-generated music and publish to streaming platforms</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <GenerationForm onGenerated={() => loadTracks()} />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Generations</h2>
          <div className="space-y-3">
            {recentTracks.length > 0 ? (
              recentTracks.map((track) => <TrackCard key={track.id} track={track} />)
            ) : (
              <p className="text-gray-500 text-sm">No tracks generated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
