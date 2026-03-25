'use client';

import { useEffect, useRef, useState } from 'react';
import { useSoundMintStore } from '@/lib/store';
import { Play, Pause, SkipBack, SkipForward, Volume2, Music } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, setIsPlaying, tracks, setCurrentTrack } = useSoundMintStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && currentTrack?.audio_url) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack, setIsPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  function handleTimeUpdate() {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }

  function skipTrack(direction: 'prev' | 'next') {
    if (!currentTrack || tracks.length === 0) return;
    const playable = tracks.filter(t => t.audio_url);
    if (playable.length === 0) return;
    const idx = playable.findIndex(t => t.id === currentTrack.id);
    let newIdx: number;
    if (direction === 'next') {
      newIdx = idx >= playable.length - 1 ? 0 : idx + 1;
    } else {
      newIdx = idx <= 0 ? playable.length - 1 : idx - 1;
    }
    setCurrentTrack(playable[newIdx]);
    setIsPlaying(true);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 px-6 py-3 z-50">
      {currentTrack.audio_url && (
        <audio
          ref={audioRef}
          src={currentTrack.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => skipTrack('next')}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}

      <div className="flex items-center gap-6 max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3 w-64">
          <div className="w-10 h-10 rounded bg-gray-800 flex-shrink-0 overflow-hidden">
            {currentTrack.cover_art_url ? (
              <img src={currentTrack.cover_art_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
            <p className="text-xs text-gray-400 truncate">{currentTrack.artist_name}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={() => skipTrack('prev')} className="text-gray-400 hover:text-white">
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (!currentTrack.audio_url) return;
                setIsPlaying(!isPlaying);
              }}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-black" />
              ) : (
                <Play className="w-4 h-4 text-black ml-0.5" />
              )}
            </button>
            <button onClick={() => skipTrack('next')} className="text-gray-400 hover:text-white">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-xs text-gray-500 w-10 text-right">{formatTime(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={progress}
              onChange={handleSeek}
              className="flex-1 h-1 accent-teal-500 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-gray-500 w-10">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-32">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-teal-500 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
