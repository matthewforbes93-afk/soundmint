'use client';

import { useEffect, useState } from 'react';
import { Track, Genre, TrackStatus } from '@/lib/types';
import TrackCard from '@/components/TrackCard';
import PublishModal from '@/components/PublishModal';
import { Library, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const statuses: (TrackStatus | 'all')[] = ['all', 'generating', 'ready', 'publishing', 'published', 'failed'];
const genres: (Genre | 'all')[] = ['all', 'lo-fi', 'ambient', 'jazz', 'classical', 'electronic', 'hip-hop', 'pop', 'r&b', 'rock', 'latin', 'afrobeat', 'country', 'meditation', 'cinematic'];

export default function LibraryPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [publishTrack, setPublishTrack] = useState<Track | null>(null);

  async function loadTracks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (genreFilter !== 'all') params.set('genre', genreFilter);
      const res = await fetch(`/api/tracks?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) setTracks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTracks(); }, [statusFilter, genreFilter]);

  async function handleDelete(track: Track) {
    if (!confirm(`Delete "${track.title}"?`)) return;
    try {
      const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Track deleted');
      loadTracks();
    } catch {
      toast.error('Failed to delete track');
    }
  }

  const filteredTracks = tracks.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artist_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectClass = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Library className="w-6 h-6 text-purple-500" />
          Track Library
        </h1>
        <p className="text-gray-400 text-sm mt-1">{tracks.length} tracks total</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracks..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
        </select>
        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className={selectClass}>
          {genres.map((g) => <option key={g} value={g}>{g === 'all' ? 'All Genres' : g}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      ) : filteredTracks.length > 0 ? (
        <div className="grid gap-3">
          {filteredTracks.map((track) => (
            <TrackCard key={track.id} track={track} onPublish={(t) => setPublishTrack(t)} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <p>No tracks found.</p>
        </div>
      )}

      {publishTrack && (
        <PublishModal track={publishTrack} onClose={() => setPublishTrack(null)} onPublished={() => loadTracks()} />
      )}
    </div>
  );
}
