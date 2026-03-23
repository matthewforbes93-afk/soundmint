'use client';

import { Track } from '@/lib/types';
import { Play, Pause, Upload, Trash2, Music } from 'lucide-react';
import { useJukeboxStore } from '@/lib/store';

const statusColors: Record<string, string> = {
  generating: 'bg-yellow-500/20 text-yellow-400',
  ready: 'bg-green-500/20 text-green-400',
  publishing: 'bg-blue-500/20 text-blue-400',
  published: 'bg-purple-500/20 text-purple-400',
  failed: 'bg-red-500/20 text-red-400',
};

interface TrackCardProps {
  track: Track;
  onPublish?: (track: Track) => void;
  onDelete?: (track: Track) => void;
}

export default function TrackCard({ track, onPublish, onDelete }: TrackCardProps) {
  const { currentTrack, isPlaying, setCurrentTrack, setIsPlaying } = useJukeboxStore();
  const isCurrentTrack = currentTrack?.id === track.id;

  function handlePlay() {
    if (isCurrentTrack && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors group">
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
          {track.cover_art_url ? (
            <img src={track.cover_art_url} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-6 h-6 text-gray-600" />
            </div>
          )}
          {track.audio_url && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white" />
              )}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-white truncate">{track.title}</h3>
              <p className="text-sm text-gray-400">{track.artist_name}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[track.status] || ''}`}>
              {track.status}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{track.genre}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{track.mood}</span>
            <span className="text-xs text-gray-500">
              {Math.floor(track.duration_seconds / 60)}:{String(track.duration_seconds % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
        {track.status === 'ready' && onPublish && (
          <button
            onClick={() => onPublish(track)}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Publish
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(track)}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
