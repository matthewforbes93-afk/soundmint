'use client';

import { useState } from 'react';
import { Genre, Mood, GenerationRequest } from '@/lib/types';
import { Layers, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const genres: Genre[] = ['lo-fi', 'ambient', 'jazz', 'classical', 'electronic', 'hip-hop', 'pop', 'r&b', 'rock', 'latin', 'afrobeat', 'country', 'meditation', 'cinematic'];
const moods: Mood[] = ['chill', 'energetic', 'melancholic', 'uplifting', 'dark', 'peaceful', 'romantic', 'epic', 'dreamy', 'aggressive'];

const promptTemplates: Record<string, string[]> = {
  'lo-fi': ['late night study vibes', 'rainy day coffee shop', 'sunset on the beach', 'quiet morning routine', 'walking through the city at night'],
  'ambient': ['floating in space', 'deep ocean currents', 'foggy mountain sunrise', 'crystal cave echoes', 'wind through the trees'],
  'jazz': ['smoky lounge after midnight', 'upbeat swing downtown', 'smooth saxophone evening', 'piano bar conversation', 'street corner jazz'],
  'electronic': ['neon city drive', 'warehouse rave energy', 'retro synthwave sunset', 'futuristic cyberpunk', 'deep bass meditation'],
  'hip-hop': ['city block summer anthem', 'late night freestyle', 'old school boom bap', 'trap beat with melody', 'chill rap instrumental'],
  'cinematic': ['epic battle scene', 'emotional farewell', 'hero rising montage', 'mysterious discovery', 'triumphant victory'],
  'meditation': ['deep breathing exercise', 'morning yoga flow', 'sleep soundscape', 'nature healing sounds', 'mindful awareness'],
  'pop': ['summer road trip', 'feel good dance', 'nostalgic memories', 'new love beginning', 'empowerment anthem'],
  'classical': ['orchestral sunrise', 'piano concerto', 'string quartet evening', 'symphonic journey', 'chamber music reflection'],
  'r&b': ['late night groove', 'silky smooth vibes', 'slow jam sunset', 'soulful morning', 'velvet lounge'],
  'rock': ['stadium anthem energy', 'garage band raw', 'classic riff driven', 'power ballad emotion', 'indie road trip'],
  'latin': ['tropical summer party', 'salsa night downtown', 'reggaeton heat', 'bossa nova cafe', 'cumbia sunset'],
  'afrobeat': ['lagos dance floor', 'highlife celebration', 'afro fusion groove', 'tribal rhythm journey', 'palm wine afternoon'],
  'country': ['open road sunrise', 'front porch sunset', 'honky tonk friday', 'river fishing morning', 'small town memories'],
};

export default function BulkGeneratePage() {
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>(['lo-fi', 'ambient']);
  const [selectedMoods, setSelectedMoods] = useState<Mood[]>(['chill', 'peaceful']);
  const [count, setCount] = useState(10);
  const [artistName, setArtistName] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null);

  function toggleItem<T>(arr: T[], item: T, setter: (v: T[]) => void) {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  }

  async function handleGenerate() {
    if (!artistName.trim()) return toast.error('Enter an artist name');
    if (!selectedGenres.length) return toast.error('Select at least one genre');
    if (!selectedMoods.length) return toast.error('Select at least one mood');

    setLoading(true);
    setResult(null);

    const requests: GenerationRequest[] = [];
    for (let i = 0; i < count; i++) {
      const genre = selectedGenres[i % selectedGenres.length];
      const mood = selectedMoods[i % selectedMoods.length];
      const templates = promptTemplates[genre] || promptTemplates['ambient'];
      const prompt = templates[i % templates.length];

      requests.push({
        genre,
        mood,
        prompt,
        artist_name: artistName,
        auto_publish: autoPublish,
        ai_provider: 'suno',
        platforms: autoPublish ? ['spotify', 'apple_music', 'youtube_music'] : [],
      });
    }

    try {
      const res = await fetch('/api/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, auto_publish: autoPublish, platforms: ['spotify', 'apple_music', 'youtube_music'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ created: data.created, failed: data.failed });
      toast.success(`${data.created} tracks queued for generation!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk generation failed');
    } finally {
      setLoading(false);
    }
  }

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
      active ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Layers className="w-6 h-6 text-purple-500" />
          Bulk Generate
        </h1>
        <p className="text-gray-400 text-sm mt-1">Generate multiple tracks at once for maximum output</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Artist Name</label>
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="e.g., Luna Waves"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Genres</label>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button key={g} onClick={() => toggleItem(selectedGenres, g, setSelectedGenres)} className={chipClass(selectedGenres.includes(g))}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Moods</label>
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button key={m} onClick={() => toggleItem(selectedMoods, m, setSelectedMoods)} className={chipClass(selectedMoods.includes(m))}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Number of Tracks: {count}</label>
          <input type="range" min={1} max={50} value={count} onChange={(e) => setCount(parseInt(e.target.value))} className="w-full accent-purple-500" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span><span>25</span><span>50</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoPublish(!autoPublish)}
            className={`relative w-11 h-6 rounded-full transition-colors ${autoPublish ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoPublish ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-sm text-gray-300">Auto-publish to Spotify, Apple Music, YouTube Music</span>
        </div>

        {result && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">{result.created} tracks queued!</p>
              {result.failed > 0 && <p className="text-sm text-gray-400">{result.failed} failed</p>}
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating {count} tracks...</>
          ) : (
            <><Layers className="w-4 h-4" /> Generate {count} Tracks</>
          )}
        </button>
      </div>
    </div>
  );
}
