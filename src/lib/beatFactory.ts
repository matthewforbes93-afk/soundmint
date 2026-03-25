/**
 * SoundMint Beat Factory
 * Generates beats INSTANTLY using Web Audio synthesis.
 * No AI, no server, no waiting. Pure client-side.
 */

// Drum patterns by genre
const DRUM_PATTERNS: Record<string, Record<string, boolean[]>> = {
  'hip-hop': {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
  },
  'trap': {
    kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1].map(Boolean),
    clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1].map(Boolean),
  },
  'lo-fi': {
    kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    clap:  [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0].map(Boolean),
  },
  'pop': {
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
  },
  'r&b': {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    hihat: [1,1,0,1, 1,0,1,1, 1,1,0,1, 1,0,1,0].map(Boolean),
    clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
  },
  'rap': {
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,0, 0,0,1,0].map(Boolean),
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    hihat: [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,0].map(Boolean),
    clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
  },
};

// Chord progressions by mood (semitone offsets from root)
const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  'chill':      [[0,4,7], [5,9,12], [7,11,14], [0,4,7]],
  'dark':       [[0,3,7], [8,12,15], [5,8,12], [7,10,14]],
  'energetic':  [[0,4,7], [7,11,14], [9,12,16], [5,9,12]],
  'uplifting':  [[0,4,7], [5,9,12], [9,12,16], [7,11,14]],
  'romantic':   [[0,4,7], [9,12,16], [5,9,12], [7,11,14]],
  'aggressive': [[0,3,7], [5,8,12], [3,7,10], [7,10,14]],
  'dreamy':     [[0,4,7], [4,7,11], [9,12,16], [5,9,12]],
  'epic':       [[0,4,7], [8,12,15], [5,9,12], [7,11,14]],
};

// Key frequencies (C3 = 130.81)
const KEY_FREQ: Record<string, number> = {
  'C': 130.81, 'C#': 138.59, 'D': 146.83, 'D#': 155.56,
  'E': 164.81, 'F': 174.61, 'F#': 185.00, 'G': 196.00,
  'G#': 207.65, 'A': 220.00, 'A#': 233.08, 'B': 246.94,
};

export interface BeatConfig {
  genre: string;
  mood: string;
  bpm: number;
  key: string;
}

export class BeatPlayer {
  private ctx: AudioContext;
  private intervalId: number | null = null;
  private step = 0;
  private config: BeatConfig;
  private masterGain: GainNode;

  constructor(config: BeatConfig) {
    this.ctx = new AudioContext();
    this.config = config;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  private playKick() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.masterGain);
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    osc.start(); osc.stop(this.ctx.currentTime + 0.5);
  }

  private playSnare() {
    const bufSize = this.ctx.sampleRate * 0.15;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    n.connect(f); f.connect(g); g.connect(this.masterGain);
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    n.start();
    // Tone body
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.connect(og); og.connect(this.masterGain);
    osc.frequency.value = 200;
    og.gain.setValueAtTime(0.4, this.ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  }

  private playHihat() {
    const bufSize = this.ctx.sampleRate * 0.04;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    n.connect(f); f.connect(g); g.connect(this.masterGain);
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
    n.start();
  }

  private playClap() {
    for (let i = 0; i < 3; i++) {
      const bufSize = this.ctx.sampleRate * 0.015;
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource(); n.buffer = buf;
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500;
      n.connect(f); f.connect(g); g.connect(this.masterGain);
      g.gain.setValueAtTime(0.3, this.ctx.currentTime + i * 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.008 + 0.08);
      n.start(this.ctx.currentTime + i * 0.008);
    }
  }

  private playChord(chordIdx: number) {
    const progression = CHORD_PROGRESSIONS[this.config.mood] || CHORD_PROGRESSIONS['chill'];
    const chord = progression[chordIdx % progression.length];
    const rootFreq = KEY_FREQ[this.config.key] || KEY_FREQ['C'];

    chord.forEach(semitone => {
      const freq = rootFreq * Math.pow(2, semitone / 12);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain); gain.connect(this.masterGain);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
      osc.start(); osc.stop(this.ctx.currentTime + 1.5);
    });
  }

  private playBass(chordIdx: number) {
    const progression = CHORD_PROGRESSIONS[this.config.mood] || CHORD_PROGRESSIONS['chill'];
    const chord = progression[chordIdx % progression.length];
    const rootFreq = (KEY_FREQ[this.config.key] || KEY_FREQ['C']) / 2; // One octave down
    const freq = rootFreq * Math.pow(2, chord[0] / 12);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq + 30, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, this.ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
    osc.start(); osc.stop(this.ctx.currentTime + 0.8);
  }

  start() {
    if (this.intervalId) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const pattern = DRUM_PATTERNS[this.config.genre] || DRUM_PATTERNS['hip-hop'];
    const msPerStep = (60 / this.config.bpm / 4) * 1000;
    this.step = 0;

    const tick = () => {
      const s = this.step % 16;

      // Drums
      if (pattern.kick[s]) this.playKick();
      if (pattern.snare[s]) this.playSnare();
      if (pattern.hihat[s]) this.playHihat();
      if (pattern.clap[s]) this.playClap();

      // Chords every 4 beats (every bar)
      if (s === 0) {
        const chordIdx = Math.floor(this.step / 16) % 4;
        this.playChord(chordIdx);
        this.playBass(chordIdx);
      }

      // Bass on beat 1 and 3
      if (s === 0 || s === 8) {
        const chordIdx = Math.floor(this.step / 16) % 4;
        this.playBass(chordIdx);
      }

      this.step++;
    };

    tick();
    this.intervalId = window.setInterval(tick, msPerStep);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.step = 0;
  }

  setVolume(v: number) {
    this.masterGain.gain.value = v;
  }

  destroy() {
    this.stop();
    this.ctx.close();
  }

  getContext(): AudioContext {
    return this.ctx;
  }
}
