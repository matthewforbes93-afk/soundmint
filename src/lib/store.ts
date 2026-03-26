/**
 * SoundMint Global Store
 *
 * Single source of truth for the entire app.
 * Project state, transport state, UI state, undo history.
 */

import { create } from 'zustand';
import { type SoundMintProject, type ProjectTrack, createProject, createTrack } from './project';

interface SoundMintStore {
  // ─── Project ───
  project: SoundMintProject | null;
  setProject: (p: SoundMintProject) => void;
  newProject: (title: string, artist: string) => void;
  updateProject: (updates: Partial<SoundMintProject>) => void;

  // ─── Tracks ───
  addTrack: (name: string, type?: ProjectTrack['type']) => ProjectTrack;
  updateTrack: (trackId: string, updates: Partial<ProjectTrack>) => void;
  removeTrack: (trackId: string) => void;

  // ─── Transport ───
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  setIsPlaying: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setCurrentTime: (t: number) => void;

  // ─── UI ───
  selectedTrackId: string | null;
  setSelectedTrack: (id: string | null) => void;

  // ─── Player (for bottom bar) ───
  currentTrack: { id: string; title: string; artist_name: string; audio_url: string | null; cover_art_url: string | null } | null;
  setCurrentTrack: (t: SoundMintStore['currentTrack']) => void;

  // ─── Undo ───
  undoStack: string[]; // JSON snapshots
  redoStack: string[];
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

export const useSoundMintStore = create<SoundMintStore>((set, get) => ({
  // ─── Project ───
  project: null,
  setProject: (project) => set({ project }),
  newProject: (title, artist) => set({ project: createProject(title, artist) }),
  updateProject: (updates) => set(s => ({
    project: s.project ? { ...s.project, ...updates, updatedAt: new Date().toISOString() } : null,
  })),

  // ─── Tracks ───
  addTrack: (name, type = 'audio') => {
    const state = get();
    const track = createTrack(name, type, state.project?.tracks.length || 0);
    set(s => ({
      project: s.project ? {
        ...s.project,
        tracks: [...s.project.tracks, track],
        updatedAt: new Date().toISOString(),
      } : null,
    }));
    return track;
  },
  updateTrack: (trackId, updates) => set(s => ({
    project: s.project ? {
      ...s.project,
      tracks: s.project.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t),
      updatedAt: new Date().toISOString(),
    } : null,
  })),
  removeTrack: (trackId) => set(s => ({
    project: s.project ? {
      ...s.project,
      tracks: s.project.tracks.filter(t => t.id !== trackId),
      updatedAt: new Date().toISOString(),
    } : null,
  })),

  // ─── Transport ───
  isPlaying: false,
  isRecording: false,
  currentTime: 0,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setCurrentTime: (currentTime) => set({ currentTime }),

  // ─── UI ───
  selectedTrackId: null,
  setSelectedTrack: (selectedTrackId) => set({ selectedTrackId }),

  // ─── Player ───
  currentTrack: null,
  setCurrentTrack: (currentTrack) => set({ currentTrack }),

  // ─── Undo ───
  undoStack: [],
  redoStack: [],
  pushUndo: () => {
    const { project, undoStack } = get();
    if (!project) return;
    const snap = JSON.stringify(project);
    const stack = [...undoStack, snap];
    if (stack.length > 30) stack.shift();
    set({ undoStack: stack, redoStack: [] });
  },
  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: JSON.parse(prev),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, JSON.stringify(project)],
    });
  },
  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: JSON.parse(next),
      undoStack: [...undoStack, JSON.stringify(project)],
      redoStack: redoStack.slice(0, -1),
    });
  },
}));
