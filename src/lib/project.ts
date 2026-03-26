/**
 * SoundMint Project Format
 *
 * Every project is a JSON document. Save, load, export, share.
 */

import { v4 as uuid } from 'uuid';
import { createServerClient } from './supabase';

// ─── Types ───

export interface SoundMintProject {
  id: string;
  version: 1;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  bpm: number;
  key: string;
  timeSignature: string;
  createdAt: string;
  updatedAt: string;
  tracks: ProjectTrack[];
  sections: ProjectSection[];
  master: MasterSettings;
  session: SessionSettings;
}

export interface ProjectTrack {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'instrument';
  color: string;
  audioUrl: string | null;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: TrackEffects;
}

export interface TrackEffects {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compThreshold: number;
  compRatio: number;
  reverbSend: number;
  delaySend: number;
}

export interface ProjectSection {
  id: string;
  name: string;
  startBar: number;
  endBar: number;
  color: string;
}

export interface MasterSettings {
  volume: number;
  eq: [number, number, number];
  compThreshold: number;
  limiterCeiling: number;
}

export interface SessionSettings {
  door: 'write' | 'record' | 'build';
  vocalPreset: string;
  autotunePreset: string;
  spacePreset: string;
  lyrics: string;
}

// ─── Defaults ───

const TRACK_COLORS = ['#34d399','#2dd4bf','#a78bfa','#22d3ee','#4ade80','#818cf8','#67e8f9','#6ee7b7'];

const DEFAULT_EFFECTS: TrackEffects = {
  eqLow: 0, eqMid: 0, eqHigh: 0,
  compThreshold: -24, compRatio: 4,
  reverbSend: 0, delaySend: 0,
};

const DEFAULT_MASTER: MasterSettings = {
  volume: 80, eq: [0, 0, 0], compThreshold: -6, limiterCeiling: -1,
};

const DEFAULT_SESSION: SessionSettings = {
  door: 'record', vocalPreset: 'warm', autotunePreset: 'off', spacePreset: 'room', lyrics: '',
};

// ─── Factory ───

export function createProject(title: string, artist: string): SoundMintProject {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    version: 1,
    title,
    artist,
    genre: 'hip-hop',
    mood: 'chill',
    bpm: 90,
    key: 'C',
    timeSignature: '4/4',
    createdAt: now,
    updatedAt: now,
    tracks: [],
    sections: [],
    master: { ...DEFAULT_MASTER },
    session: { ...DEFAULT_SESSION },
  };
}

export function createTrack(name: string, type: ProjectTrack['type'] = 'audio', index = 0): ProjectTrack {
  return {
    id: uuid(),
    name,
    type,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    audioUrl: null,
    volume: 80,
    pan: 0,
    mute: false,
    solo: false,
    effects: { ...DEFAULT_EFFECTS },
  };
}

// ─── Persistence (client-side calls to API) ───

export async function saveProject(project: SoundMintProject): Promise<string> {
  project.updatedAt = new Date().toISOString();
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data.id;
}

export async function loadProject(id: string): Promise<SoundMintProject> {
  const res = await fetch(`/api/projects/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Load failed');
  return data.data as SoundMintProject;
}

export async function listProjects(): Promise<{ id: string; title: string; artist: string; updatedAt: string }[]> {
  const res = await fetch('/api/projects');
  const data = await res.json();
  if (!res.ok) return [];
  return data;
}

// ─── Export as file ───

export function exportProjectFile(project: SoundMintProject): Blob {
  return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
}

export function importProjectFile(json: string): SoundMintProject {
  return JSON.parse(json) as SoundMintProject;
}
