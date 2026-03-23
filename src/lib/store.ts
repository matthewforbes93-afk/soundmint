import { create } from 'zustand';
import { Track, DashboardStats } from './types';

interface JukeboxStore {
  tracks: Track[];
  setTracks: (tracks: Track[]) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;

  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;

  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  generationProgress: string;
  setGenerationProgress: (msg: string) => void;

  currentTrack: Track | null;
  isPlaying: boolean;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (v: boolean) => void;

  statusFilter: string;
  genreFilter: string;
  setStatusFilter: (f: string) => void;
  setGenreFilter: (f: string) => void;
}

export const useJukeboxStore = create<JukeboxStore>((set) => ({
  tracks: [],
  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((s) => ({ tracks: [track, ...s.tracks] })),
  updateTrack: (id, updates) => set((s) => ({
    tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  })),

  stats: null,
  setStats: (stats) => set({ stats }),

  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  generationProgress: '',
  setGenerationProgress: (generationProgress) => set({ generationProgress }),

  currentTrack: null,
  isPlaying: false,
  setCurrentTrack: (currentTrack) => set({ currentTrack, isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  statusFilter: 'all',
  genreFilter: 'all',
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setGenreFilter: (genreFilter) => set({ genreFilter }),
}));
