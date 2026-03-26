# SoundMint Architecture — The Blueprint

## Principle

Every decision flows from one question: **"Would a professional use this in a paid session?"**

If the answer is no, we don't build it. If the answer is "only if it worked perfectly," then we build it perfectly or not at all.

---

## 1. Audio Engine

### The Problem Now
- 15+ scattered `new AudioContext()` calls across files
- Session page creates contexts in startRecording, playMix, stopRecording, monitoring
- Studio page creates contexts in play effect, per-track loading, recording
- BeatFactory creates its own context
- Nodes get created and never disconnected (memory leak)
- `createMediaElementSource` crashes on second call
- No centralized metering, routing, or state

### The Solution: `AudioEngine` singleton

```
┌─────────────────────────────────────────────────┐
│                  AudioEngine                     │
│                                                  │
│  ONE AudioContext for the entire app             │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Track 1  │  │ Track 2  │  │ Track N  │      │
│  │ source   │  │ source   │  │ source   │      │
│  │ ↓        │  │ ↓        │  │ ↓        │      │
│  │ EQ       │  │ EQ       │  │ EQ       │      │
│  │ ↓        │  │ ↓        │  │ ↓        │      │
│  │ Comp     │  │ Comp     │  │ Comp     │      │
│  │ ↓        │  │ ↓        │  │ ↓        │      │
│  │ Gain     │  │ Gain     │  │ Gain     │      │
│  │ ↓        │  │ ↓        │  │ ↓        │      │
│  │ Pan      │  │ Pan      │  │ Pan      │      │
│  │ ↓        │  │ ↓        │  │ ↓        │      │
│  │ Analyser │  │ Analyser │  │ Analyser │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       └──────────────┼──────────────┘            │
│                      ↓                           │
│              ┌──────────────┐                    │
│              │  Master Bus  │                    │
│              │  EQ → Comp   │                    │
│              │  → Limiter   │                    │
│              │  → Analyser  │                    │
│              │  → Dest      │                    │
│              └──────────────┘                    │
│                                                  │
│  Methods:                                        │
│  - createTrack(id) → TrackNode                   │
│  - loadAudio(trackId, url) → Promise<bool>       │
│  - play(trackId, offset?, loop?)                 │
│  - stop(trackId)                                 │
│  - playAll() / stopAll()                         │
│  - record(trackId) → Promise<Blob>               │
│  - setTrackParam(trackId, param, value)          │
│  - getLevel(trackId) → [L, R]                   │
│  - getMasterLevel() → [L, R]                    │
│  - connectMicMonitor(presetName) → cleanup fn    │
│  - dispose()                                     │
│                                                  │
│  Properties:                                     │
│  - ctx: AudioContext (readonly)                  │
│  - isPlaying: boolean                            │
│  - isRecording: boolean                          │
│  - currentTime: number                           │
│  - bpm: number                                   │
│  - masterVolume: number                          │
└─────────────────────────────────────────────────┘
```

### File: `src/lib/audio-engine.ts`

One file. One class. Every audio operation in the entire app goes through it.

Rules:
- NEVER create an AudioContext outside this file
- NEVER call `createMediaElementSource` — use `decodeAudioData` + `BufferSource` instead
- NEVER use `<audio>` elements for playback — everything through the engine
- Every node connection has a corresponding disconnect in `dispose()`
- Metering uses real AnalyserNode data, never Math.random()

---

## 2. Project Format

### The Problem Now
- Track data scattered: some in useState, some in Supabase, some in refs
- No way to save a complete project and reopen it exactly as it was
- Session state (presets, volumes, beat config) not persisted properly
- No version history of the actual project

### The Solution: `SoundMintProject` JSON schema

```typescript
interface SoundMintProject {
  // Metadata
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

  // Tracks
  tracks: ProjectTrack[];

  // Arrangement
  sections: { id: string; name: string; startBar: number; endBar: number; color: string }[];

  // Mix settings
  master: {
    volume: number;
    eq: [number, number, number];
    compThreshold: number;
    compRatio: number;
    limiterCeiling: number;
  };

  // Session preferences
  session: {
    door: 'write' | 'record' | 'build';
    vocalPreset: string;
    autotunePreset: string;
    spacePreset: string;
    lyrics: string;
  };
}

interface ProjectTrack {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'instrument';
  color: string;

  // Audio
  audioUrl: string | null;
  clips: ProjectClip[];

  // Mix
  volume: number;   // 0-100
  pan: number;       // -100 to 100
  mute: boolean;
  solo: boolean;

  // Effects
  effects: {
    eq: [number, number, number];
    compThreshold: number;
    compRatio: number;
    reverbSend: number;
    delaySend: number;
  };

  // Automation
  automation: {
    param: string;
    points: { bar: number; value: number }[];
  }[];
}

interface ProjectClip {
  id: string;
  audioUrl: string;
  startBar: number;
  durationBars: number;
  offset: number;      // Start offset within the audio file
  gain: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
}
```

### File: `src/lib/project.ts`

Functions:
- `createProject(title, artist): SoundMintProject`
- `saveProject(project): Promise<string>` — saves to Supabase
- `loadProject(id): Promise<SoundMintProject>` — loads from Supabase
- `exportProjectFile(project): Blob` — download as .smint file
- `importProjectFile(file): SoundMintProject` — load from .smint file

---

## 3. Design System

### The Problem Now
- Every component has its own styling approach
- Buttons look different on every page
- No consistent spacing, sizing, or color usage
- Dark theme is inconsistent (some pages are #000, others #0a0a0f, others gray-950)

### The Solution: Component library in `src/components/ui/`

```
src/components/ui/
  Button.tsx        — primary, secondary, ghost, danger variants
  Input.tsx         — text, number, with label + error state
  Slider.tsx        — horizontal, vertical, with label + value display
  Knob.tsx          — SVG rotary knob (from studio, extracted)
  Select.tsx        — dropdown with consistent styling
  Toggle.tsx        — on/off switch
  Modal.tsx         — overlay dialog
  Card.tsx          — container with border + padding
  Badge.tsx         — status indicators
  Meter.tsx         — level meter (from LevelMeter, extracted)
  Tooltip.tsx       — hover info
  Tabs.tsx          — tab selector
```

### Design Tokens

```typescript
// src/lib/theme.ts
export const theme = {
  colors: {
    bg: '#000000',
    surface: '#0a0a0f',
    surfaceHover: '#111118',
    border: 'rgba(255,255,255,0.05)',
    borderHover: 'rgba(255,255,255,0.1)',
    text: '#ffffff',
    textMuted: '#666666',
    textDim: '#333333',
    accent: '#14b8a6',       // Teal
    accentHover: '#0d9488',
    accentGlow: 'rgba(20,184,166,0.1)',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  font: {
    sans: 'Geist, system-ui, sans-serif',
    mono: 'Geist Mono, monospace',
  },
};
```

---

## 4. State Management

### The Problem Now
- Zustand store exists but barely used
- Most state is local useState in 800+ line components
- No single source of truth for "what's the current project"
- Player state disconnected from Studio state

### The Solution: Zustand store as single source of truth

```typescript
// src/lib/store.ts
interface SoundMintStore {
  // Current project
  project: SoundMintProject | null;
  setProject: (p: SoundMintProject) => void;
  updateTrack: (trackId: string, updates: Partial<ProjectTrack>) => void;
  addTrack: (track: ProjectTrack) => void;
  removeTrack: (trackId: string) => void;

  // Transport
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  bpm: number;
  play: () => void;
  stop: () => void;
  record: () => void;

  // UI state
  selectedTrackId: string | null;
  activeView: 'session' | 'studio' | 'mix';

  // Undo
  undoStack: SoundMintProject[];
  redoStack: SoundMintProject[];
  undo: () => void;
  redo: () => void;
  pushUndo: () => void;
}
```

---

## 5. Page Architecture

### Current mess
```
/ (Home) — dashboard with stats
/session — 800-line monolith
/studio — 1000-line monolith
/playground — generation forms
/recorder — separate recording page
/library — track list
/projects — track list (duplicate of library)
/distribute — placeholder
/collaborate — placeholder
/marketplace — placeholder
/settings — localStorage only
```

### Clean architecture
```
/ (Home)
  → Quick actions: Create, Studio, Library
  → Recent projects
  → Stats

/create (replaces /session)
  → Three doors: Write, Record, Build
  → Self-contained session flow
  → Uses AudioEngine + ProjectFormat
  → Saves project to Supabase on every action

/studio
  → Opens a project (from /create or /library)
  → Timeline, mixer, instruments, effects
  → Uses AudioEngine for all audio
  → Auto-saves project state

/library
  → All projects + exported tracks
  → Search, filter, sort
  → Open in Studio, Export, Distribute, Delete

/distribute
  → Select a project → one-click publish
  → DistroKid integration
  → Release scheduling, metadata

/marketplace
  → List beats for sale
  → Stripe payments
  → License management

/settings
  → API keys (persisted to Supabase, not localStorage)
  → Audio preferences (buffer size, sample rate)
  → Account management
```

Pages removed: `/projects` (merged into `/library`), `/recorder` (merged into `/create`), `/playground` (merged into `/create` AI door), `/collaborate` (merged into Studio sharing)

---

## 6. File Structure

```
src/
  app/
    page.tsx              — Home
    layout.tsx            — Root layout with sidebar
    create/
      page.tsx            — Three doors + session flow
      layout.tsx          — Full-screen, no sidebar
    studio/
      page.tsx            — DAW
      layout.tsx          — Full-screen, no sidebar
    library/
      page.tsx            — Projects + tracks
    distribute/
      page.tsx            — Publishing
    marketplace/
      page.tsx            — Beat store
    settings/
      page.tsx            — Preferences
    api/
      tracks/             — Track CRUD
      projects/           — Project CRUD (replaces sessions)
      upload/             — File upload
      export/             — Mix + master + download
      distribute/         — DistroKid
      payments/           — Stripe

  components/
    ui/                   — Design system components
      Button.tsx
      Input.tsx
      Slider.tsx
      Knob.tsx
      Toggle.tsx
      Modal.tsx
      Card.tsx
      Meter.tsx
      Tabs.tsx
    session/              — Create page components
      DoorSelect.tsx
      SetupForm.tsx
      RecordingBooth.tsx
      MixView.tsx
      ExportView.tsx
      CircularVisualizer.tsx
    studio/               — Studio page components
      TransportBar.tsx
      Timeline.tsx
      TrackLane.tsx
      MixerChannel.tsx
      MasterChannel.tsx
      EffectsRack.tsx
      InstrumentPanel.tsx
    instruments/          — Sound generators
      Synth.tsx
      DrumMachine.tsx
      PianoRoll.tsx
      ChordGenerator.tsx
      BassSynth.tsx
    shared/               — Used across pages
      Sidebar.tsx
      Player.tsx          — Bottom player (if needed)

  lib/
    audio-engine.ts       — THE audio engine
    beat-factory.ts       — Beat synthesis
    project.ts            — Project format + save/load
    store.ts              — Zustand store
    supabase.ts           — Database client
    types.ts              — Type definitions
    theme.ts              — Design tokens
    use-keyboard.ts       — Keyboard shortcuts
    use-midi.ts           — MIDI controller support
```

---

## 7. Database Schema

```sql
-- Users (Supabase Auth handles this)

-- Projects (replaces tracks + sessions tables)
CREATE TABLE projects (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  title text NOT NULL,
  artist text NOT NULL,
  data jsonb NOT NULL,          -- Full SoundMintProject JSON
  thumbnail_url text,
  status text DEFAULT 'draft',  -- draft, published, archived
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audio files
CREATE TABLE audio_files (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  filename text NOT NULL,
  url text NOT NULL,
  duration_seconds float,
  format text,                  -- wav, mp3, webm
  size_bytes bigint,
  created_at timestamptz DEFAULT now()
);

-- Marketplace listings
CREATE TABLE listings (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  user_id uuid REFERENCES auth.users,
  price_lease decimal,
  price_premium decimal,
  price_exclusive decimal,
  plays integer DEFAULT 0,
  sales integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Distributions
CREATE TABLE distributions (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects,
  platform text NOT NULL,
  status text DEFAULT 'pending',
  external_id text,
  external_url text,
  isrc text,
  upc text,
  submitted_at timestamptz,
  live_at timestamptz
);
```

---

## 8. Build Order

| Step | What | Why First |
|---|---|---|
| 1 | `audio-engine.ts` | Everything depends on this |
| 2 | `project.ts` + schema | Everything saves/loads through this |
| 3 | `theme.ts` + `ui/` components | Everything renders with these |
| 4 | `store.ts` rewrite | Single source of truth |
| 5 | `/create` page (session rebuild) | The front door |
| 6 | `/studio` page (DAW rebuild) | The main tool |
| 7 | `/library` page | Project management |
| 8 | `/distribute` + `/marketplace` | Business layer |

Each step is one focused session. No jumping ahead. No half-building.

---

## 9. What This Architecture Enables

- **Every audio operation** goes through one engine — no bugs from scattered contexts
- **Every project** is a JSON file — save, load, export, share, version
- **Every component** uses the design system — consistent look everywhere
- **Every state change** goes through the store — undo/redo works globally
- **Mobile works** because components are responsive from day one
- **Collaboration works** because project state is serializable
- **Offline works** because projects can save to IndexedDB
- **Plugins work** because the audio engine has a standard track interface

---

## 10. What We Keep From Current Build

- BeatFactory (beat synthesis) — works, keep as-is
- Synth, DrumMachine, PianoRoll, ChordGenerator, BassSynth — all work
- LevelMeter — works (move to ui/Meter.tsx)
- All API routes — work
- MusicGen server — works
- Supabase connection — works
- PWA manifest — keep
- Web MIDI hook — keep

## What We Throw Away

- Session page (800 lines) — rewrite as composable components
- Studio page (1000 lines) — rewrite as composable components
- Scattered AudioContext creation — replaced by engine
- useState-based undo — replaced by store
- localStorage settings — replaced by Supabase
- Fake meters — replaced by real AnalyserNode data
- Direct audio element playback — replaced by engine BufferSource
