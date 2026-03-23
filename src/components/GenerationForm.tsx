'use client';

import { useState } from 'react';
import { GenerationRequest, Genre, Mood, DistributionPlatform } from '@/lib/types';
import { Wand2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const genres: Genre[] = ['lo-fi', 'ambient', 'jazz', 'classical', 'electronic', 'hip-hop', 'pop', 'r&b', 'rock', 'latin', 'afrobeat', 'country', 'meditation', 'cinematic'];
const moods: Mood[] = ['chill', 'energetic', 'melancholic', 'uplifting', 'dark', 'peaceful', 'romantic', 'epic', 'dreamy', 'aggressive'];
const platforms: { value: DistributionPlatform; label: string }[] = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'amazon_music', label: 'Amazon Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'deezer', label: 'Deezer' },
  { value: 'tidal', label: 'Tidal' },
];
const providers = [
  { value: 'suno', label: 'Suno (Best vocals)' },
  { value: 'stable_audio', label: 'Stable Audio (Best instrumentals)' },
  { value: 'loudly', label: 'Loudly (Best API)' },
];

interface GenerationFormProps {
  onGenerated?: (trackId: string) => void;
}

export default function GenerationForm({ onGenerated }: GenerationFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<GenerationRequest>({
    genre: 'lo-fi',
    mood: 'chill',
    prompt: '',
    duration: 180,
    with_vocals: false,
    lyrics: '',
    artist_name: '',
    auto_publish: false,
    platforms: [],
    ai_provider: 'suno',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.prompt.trim()) return toast.error('Enter a prompt');
    if (!form.artist_name.trim()) return toast.error('Enter an artist name');

    setLoading(true);
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Track generation started!');
      onGenerated?.(data.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Genre</label>
          <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value as Genre })} className={inputClass}>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Mood</label>
          <select value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value as Mood })} className={inputClass}>
            {moods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>AI Provider</label>
        <select value={form.ai_provider} onChange={(e) => setForm({ ...form, ai_provider: e.target.value as GenerationRequest['ai_provider'] })} className={inputClass}>
          {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClass}>Artist Name</label>
        <input type="text" value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} placeholder="e.g., Luna Waves" className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Prompt</label>
        <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Describe the track you want to create..." rows={3} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Duration: {form.duration}s ({Math.floor((form.duration || 180) / 60)}:{String((form.duration || 180) % 60).padStart(2, '0')})</label>
        <input type="range" min={30} max={480} step={30} value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} className="w-full accent-purple-500" />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setForm({ ...form, with_vocals: !form.with_vocals })}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.with_vocals ? 'bg-purple-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.with_vocals ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">Include vocals</span>
      </div>

      {form.with_vocals && (
        <div>
          <label className={labelClass}>Lyrics (optional)</label>
          <textarea value={form.lyrics} onChange={(e) => setForm({ ...form, lyrics: e.target.value })} placeholder="Enter custom lyrics or leave blank for AI-generated..." rows={4} className={inputClass} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setForm({ ...form, auto_publish: !form.auto_publish })}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.auto_publish ? 'bg-purple-600' : 'bg-gray-700'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.auto_publish ? 'translate-x-5' : ''}`} />
        </button>
        <span className="text-sm text-gray-300">Auto-publish after generation</span>
      </div>

      {form.auto_publish && (
        <div>
          <label className={labelClass}>Platforms</label>
          <div className="grid grid-cols-2 gap-2">
            {platforms.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.platforms?.includes(value) || false}
                  onChange={(e) => {
                    const selected = form.platforms || [];
                    setForm({
                      ...form,
                      platforms: e.target.checked ? [...selected, value] : selected.filter((p) => p !== value),
                    });
                  }}
                  className="rounded bg-gray-800 border-gray-700 text-purple-500 focus:ring-purple-500"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
        ) : (
          <><Wand2 className="w-4 h-4" /> Generate Track</>
        )}
      </button>
    </form>
  );
}
