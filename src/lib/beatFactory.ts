/**
 * SoundMint Beat Factory
 * Generates beats INSTANTLY using Web Audio synthesis.
 * No AI, no server, no waiting. Pure client-side.
 */

// Randomize a pattern — add/remove hits with probability
function varyPattern(base: boolean[], prob: number = 0.15): boolean[] {
  return base.map((v, i) => {
    if (Math.random() < prob) return !v; // Flip some beats
    return v;
  });
}

// Add swing — delay every other hit slightly
function addSwing(pattern: boolean[], amount: number = 0.3): boolean[] {
  // Swing is handled in timing, not pattern — return as-is
  return pattern;
}

// Generate a unique variation of a genre pattern
function generateVariation(genre: string): Record<string, boolean[]> {
  const base = DRUM_PATTERNS[genre] || DRUM_PATTERNS['hip-hop'];
  return {
    kick: varyPattern(base.kick, 0.1),
    snare: [...base.snare], // Keep snare consistent
    hihat: varyPattern(base.hihat, 0.2),
    clap: varyPattern(base.clap, 0.15),
  };
}

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
  private samplesLoaded = false;
  private sampleBuffers: Record<string, AudioBuffer> = {};

  // Stereo buses for spatial placement
  private hhPan: StereoPannerNode;
  private clapPan: StereoPannerNode;
  private chordPanL: StereoPannerNode;
  private chordPanR: StereoPannerNode;

  constructor(config: BeatConfig) {
    this.ctx = new AudioContext();
    this.config = config;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    // Stereo placement
    this.hhPan = this.ctx.createStereoPanner(); this.hhPan.pan.value = 0.35; // Hihats slightly right
    this.clapPan = this.ctx.createStereoPanner(); this.clapPan.pan.value = -0.15; // Clap slightly left
    this.chordPanL = this.ctx.createStereoPanner(); this.chordPanL.pan.value = -0.5; // Chords wide left
    this.chordPanR = this.ctx.createStereoPanner(); this.chordPanR.pan.value = 0.5; // Chords wide right

    this.hhPan.connect(this.masterGain);
    this.clapPan.connect(this.masterGain);
    this.chordPanL.connect(this.masterGain);
    this.chordPanR.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Load WAV samples
    this.loadSamples();
  }

  private async loadSamples() {
    const sampleNames = ['kick', 'snare', 'hihat', 'hihat-open', 'clap', '808', 'rim', 'perc'];
    try {
      await Promise.all(sampleNames.map(async (name) => {
        const res = await fetch(`/samples/${name}.wav`);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        this.sampleBuffers[name] = await this.ctx.decodeAudioData(buf);
      }));
      this.samplesLoaded = true;
    } catch {
      // Samples failed to load — will fall back to synthesis
      this.samplesLoaded = false;
    }
  }

  private playSample(name: string, dest: AudioNode, volume = 1.0) {
    const buffer = this.sampleBuffers[name];
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * (0.8 + Math.random() * 0.2); // Velocity variation
    source.connect(gain);
    gain.connect(dest);
    source.start();
  }

  private playKick() {
    if (this.samplesLoaded && this.sampleBuffers['kick']) {
      this.playSample('kick', this.masterGain, 0.9);
      return;
    }
    const t = this.ctx.currentTime;
    const vel = 0.7 + Math.random() * 0.3;

    // Sub layer — deep sine for weight
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(60, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    sub.connect(subGain); subGain.connect(this.masterGain);
    subGain.gain.setValueAtTime(vel * 0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    sub.start(t); sub.stop(t + 0.6);

    // Click layer — attack transient
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(160, t);
    click.frequency.exponentialRampToValueAtTime(40, t + 0.03);
    click.connect(clickGain); clickGain.connect(this.masterGain);
    clickGain.gain.setValueAtTime(vel * 0.6, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    click.start(t); click.stop(t + 0.05);

    // Body — pitch sweep
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(150, t);
    body.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
    body.connect(bodyGain); bodyGain.connect(this.masterGain);
    bodyGain.gain.setValueAtTime(vel * 0.8, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    body.start(t); body.stop(t + 0.4);
  }

  private playSnare() {
    if (this.samplesLoaded && this.sampleBuffers['snare']) {
      this.playSample('snare', this.masterGain, 0.8);
      return;
    }
    const t = this.ctx.currentTime;
    const vel = 0.5 + Math.random() * 0.2;

    // Noise layer — wide, crispy
    const noiseLen = this.ctx.sampleRate * 0.2;
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen * 0.5);
    const noise = this.ctx.createBufferSource(); noise.buffer = noiseBuf;
    const noiseGain = this.ctx.createGain();
    const noiseBP = this.ctx.createBiquadFilter(); noiseBP.type = 'bandpass'; noiseBP.frequency.value = 3000; noiseBP.Q.value = 0.8;
    const noiseHP = this.ctx.createBiquadFilter(); noiseHP.type = 'highpass'; noiseHP.frequency.value = 1000;
    noise.connect(noiseHP); noiseHP.connect(noiseBP); noiseBP.connect(noiseGain); noiseGain.connect(this.masterGain);
    noiseGain.gain.setValueAtTime(vel * 0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    noise.start(t);

    // Body tone — snare ring
    const tone = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(220, t);
    tone.frequency.exponentialRampToValueAtTime(120, t + 0.05);
    tone.connect(toneGain); toneGain.connect(this.masterGain);
    toneGain.gain.setValueAtTime(vel * 0.5, t);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    tone.start(t); tone.stop(t + 0.1);

    // Snap — high transient
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = 'sine';
    snap.frequency.value = 400;
    snap.connect(snapGain); snapGain.connect(this.masterGain);
    snapGain.gain.setValueAtTime(vel * 0.3, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    snap.start(t); snap.stop(t + 0.02);
  }

  private playHihat(open = false) {
    if (this.samplesLoaded) {
      const name = open ? 'hihat-open' : 'hihat';
      if (this.sampleBuffers[name]) { this.playSample(name, this.hhPan, 0.6); return; }
    }
    const t = this.ctx.currentTime;
    const vel = 0.15 + Math.random() * 0.1;
    const duration = open ? 0.15 : 0.04 + Math.random() * 0.02;

    // Multi-band noise for metallic sound
    const len = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const gain = this.ctx.createGain();
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 10000; bp.Q.value = 2; bp.gain.value = 6;
    src.connect(hp); hp.connect(bp); bp.connect(gain); gain.connect(this.hhPan);
    gain.gain.setValueAtTime(vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.start(t);

    // Add slight ring for metallic character
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'square';
    ring.frequency.value = 12000 + Math.random() * 2000;
    ring.connect(ringGain); ringGain.connect(this.hhPan);
    ringGain.gain.setValueAtTime(vel * 0.1, t);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.5);
    ring.start(t); ring.stop(t + duration);
  }

  private playClap() {
    if (this.samplesLoaded && this.sampleBuffers['clap']) {
      this.playSample('clap', this.clapPan, 0.7);
      return;
    }
    const t = this.ctx.currentTime;
    const vel = 0.4 + Math.random() * 0.15;

    // Multiple noise bursts for realistic clap
    for (let i = 0; i < 4; i++) {
      const offset = i * 0.007 + Math.random() * 0.003;
      const len = this.ctx.sampleRate * 0.025;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < len; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const gain = this.ctx.createGain();
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000 + Math.random() * 500; bp.Q.value = 1.5;
      src.connect(bp); bp.connect(gain); gain.connect(this.clapPan);
      gain.gain.setValueAtTime(vel * (0.6 + i * 0.1), t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.12);
      src.start(t + offset);
    }

    // Reverb tail
    const tailLen = this.ctx.sampleRate * 0.15;
    const tailBuf = this.ctx.createBuffer(1, tailLen, this.ctx.sampleRate);
    const tailData = tailBuf.getChannelData(0);
    for (let i = 0; i < tailLen; i++) tailData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (tailLen * 0.3));
    const tail = this.ctx.createBufferSource(); tail.buffer = tailBuf;
    const tailGain = this.ctx.createGain();
    const tailBP = this.ctx.createBiquadFilter(); tailBP.type = 'bandpass'; tailBP.frequency.value = 1500; tailBP.Q.value = 0.5;
    tail.connect(tailBP); tailBP.connect(tailGain); tailGain.connect(this.clapPan);
    tailGain.gain.setValueAtTime(vel * 0.25, t + 0.03);
    tailGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    tail.start(t + 0.03);
  }

  private playChord(chordIdx: number) {
    const progression = CHORD_PROGRESSIONS[this.config.mood] || CHORD_PROGRESSIONS['chill'];
    const chord = progression[chordIdx % progression.length];
    const rootFreq = KEY_FREQ[this.config.key] || KEY_FREQ['C'];

    chord.forEach(semitone => {
      const freq = rootFreq * Math.pow(2, semitone / 12);

      // Layer 1: warm pad (sawtooth filtered)
      const saw = this.ctx.createOscillator();
      const sawGain = this.ctx.createGain();
      const sawFilter = this.ctx.createBiquadFilter();
      saw.type = 'sawtooth';
      saw.frequency.value = freq;
      sawFilter.type = 'lowpass'; sawFilter.frequency.value = 1500; sawFilter.Q.value = 0.5;
      // Alternate chords between left and right for stereo width
      const chordDest = semitone % 2 === 0 ? this.chordPanL : this.chordPanR;
      saw.connect(sawFilter); sawFilter.connect(sawGain); sawGain.connect(chordDest);
      sawGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      sawGain.gain.setValueAtTime(0.05, this.ctx.currentTime + 0.1);
      sawGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.5);
      saw.start(); saw.stop(this.ctx.currentTime + 2.5);

      // Layer 2: soft sine for warmth
      const sine = this.ctx.createOscillator();
      const sineGain = this.ctx.createGain();
      sine.type = 'sine';
      sine.frequency.value = freq;
      sine.connect(sineGain); sineGain.connect(semitone % 2 === 0 ? this.chordPanR : this.chordPanL);
      sineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      sineGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);
      sine.start(); sine.stop(this.ctx.currentTime + 2.0);
    });
  }

  private playBass(chordIdx: number) {
    const t = this.ctx.currentTime;
    const progression = CHORD_PROGRESSIONS[this.config.mood] || CHORD_PROGRESSIONS['chill'];
    const chord = progression[chordIdx % progression.length];
    const rootFreq = (KEY_FREQ[this.config.key] || KEY_FREQ['C']) / 2;
    const freq = rootFreq * Math.pow(2, chord[0] / 12);

    // Sub bass — pure sine, long sustain
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq + 40, t);
    sub.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    sub.connect(subGain); subGain.connect(this.masterGain);
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.setValueAtTime(0.4, t + 0.1);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    sub.start(t); sub.stop(t + 1.2);

    // Harmonics — slight saturation
    const harm = this.ctx.createOscillator();
    const harmGain = this.ctx.createGain();
    const harmFilter = this.ctx.createBiquadFilter();
    harm.type = 'sawtooth';
    harm.frequency.setValueAtTime(freq * 2 + 40, t);
    harm.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.06);
    harmFilter.type = 'lowpass'; harmFilter.frequency.value = 400;
    harm.connect(harmFilter); harmFilter.connect(harmGain); harmGain.connect(this.masterGain);
    harmGain.gain.setValueAtTime(0.12, t);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    harm.start(t); harm.stop(t + 0.8);
  }

  start() {
    if (this.intervalId) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Generate pattern ONCE per start (not every loop)
    if (!this._pattern) {
      this._pattern = generateVariation(this.config.genre);
    }
    const pattern = this._pattern;
    const secPerStep = 60 / this.config.bpm / 4;
    this.step = 0;

    // Use lookahead scheduling for tight timing
    // Schedule notes slightly ahead using Web Audio's clock
    let nextStepTime = this.ctx.currentTime + 0.05; // Start 50ms from now

    const scheduler = () => {
      // Schedule all steps that fall within the next 100ms
      while (nextStepTime < this.ctx.currentTime + 0.1) {
        const s = this.step % 16;
        const t = nextStepTime;

        // Drums — scheduled at exact audio time
        if (pattern.kick[s]) this.playKick();
        if (pattern.snare[s]) this.playSnare();
        if (pattern.hihat[s]) this.playHihat(s % 8 === 6);
        if (pattern.clap[s]) this.playClap();

        // Chords on beat 1 of each bar
        if (s === 0) {
          const chordIdx = Math.floor(this.step / 16) % 4;
          this.playChord(chordIdx);
        }

        // Bass on beats 1 and 3
        if (s === 0 || s === 8) {
          const chordIdx = Math.floor(this.step / 16) % 4;
          this.playBass(chordIdx);
        }

        this.step++;
        nextStepTime += secPerStep;
      }
    };

    // Run scheduler every 25ms (faster than 100ms lookahead = no gaps)
    this.intervalId = window.setInterval(scheduler, 25);
  }

  private _pattern: Record<string, boolean[]> | null = null;

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

