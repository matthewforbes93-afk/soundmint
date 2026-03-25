'use client';

import { useState } from 'react';
import GenerationForm from '@/components/GenerationForm';
import { Track } from '@/lib/types';
import TrackCard from '@/components/TrackCard';
import { Wand2, Layers } from 'lucide-react';

export default function PlaygroundPage() {
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  async function loadTracks() {
    try {
      const res = await fetch('/api/tracks');
      const data = await res.json();
      if (Array.isArray(data)) setRecentTracks(data.slice(0, 6));
    } catch { /* ignore */ }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-purple-500" />
          AI Playground
        </h1>
        <p className="text-gray-400 text-sm mt-1">Generate music with AI — pick a genre, customize, and create</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'single' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          <Wand2 className="w-4 h-4" /> Single Track
        </button>
        <button onClick={() => setActiveTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'bulk' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          <Layers className="w-4 h-4" /> Bulk Generate
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {activeTab === 'single' ? (
              <GenerationForm onGenerated={() => loadTracks()} />
            ) : (
              <BulkSection onGenerated={() => loadTracks()} />
            )}
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

// Inline bulk generation section
function BulkSection({ onGenerated }: { onGenerated: () => void }) {
  const [count, setCount] = useState(10);
  const [artistName, setArtistName] = useState('');
  const [loading, setLoading] = useState(false);

  const genres = ['lo-fi', 'ambient', 'jazz', 'electronic', 'hip-hop', 'meditation', 'cinematic'];
  const [selectedGenres, setSelectedGenres] = useState(['lo-fi', 'ambient']);

  async function handleGenerate() {
    if (!artistName.trim()) return;
    setLoading(true);

    const prompts: Record<string, string[]> = {
      'lo-fi': ['rainy window study session', 'quiet morning coffee', 'sunset walk home'],
      'ambient': ['floating in space', 'deep ocean', 'forest at dawn'],
      'jazz': ['smoky lounge', 'late night piano bar', 'street corner saxophone'],
      'electronic': ['neon city drive', 'warehouse energy', 'retro synthwave'],
      'hip-hop': ['city block anthem', 'late night freestyle', 'chill boom bap'],
      'meditation': ['deep breathing', 'morning yoga', 'sleep sounds'],
      'cinematic': ['epic battle', 'emotional farewell', 'hero rising'],
    };

    const requests = Array.from({ length: count }, (_, i) => {
      const genre = selectedGenres[i % selectedGenres.length];
      const genrePrompts = prompts[genre] || prompts['ambient'];
      return { genre, mood: 'chill', prompt: genrePrompts[i % genrePrompts.length], artist_name: artistName, ai_provider: 'musicgen' as const };
    });

    try {
      await fetch('/api/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, auto_publish: false, platforms: [] }),
      });
      onGenerated();
    } catch { /* ignore */ }
    setLoading(false);
  }

  const chip = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Artist Name</label>
        <input type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="e.g., Luna Waves" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Genres</label>
        <div className="flex flex-wrap gap-2">
          {genres.map(g => (
            <button key={g} type="button" onClick={() => setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} className={chip(selectedGenres.includes(g))}>{g}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Tracks: {count}</label>
        <input type="range" min={1} max={50} value={count} onChange={(e) => setCount(parseInt(e.target.value))} className="w-full accent-purple-500" />
      </div>
      <button onClick={handleGenerate} disabled={loading || !artistName.trim()} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2">
        <Layers className="w-4 h-4" /> Generate {count} Tracks
      </button>
    </div>
  );
}
