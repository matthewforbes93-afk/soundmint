"""
SoundMint Local Music Server
- MusicGen: instrumental music generation (Meta)
- Demucs: stem separation (Meta) — drums, bass, vocals, other
- Auto-mastering: loudness normalization, EQ, compression
- Mixing: per-stem volume, pan, reverb, EQ, compression, delay, chorus
- Audio analysis: BPM detection, key detection
- Effects processing: EQ, compression, delay, chorus, reverb
- MP3/WAV output
Endpoints:
  POST /generate       — generate music
  POST /master         — master uploaded audio
  POST /separate       — separate audio into stems
  POST /mix            — mix stems with volume/pan/reverb/EQ/compression/delay/chorus
  POST /analyze        — detect BPM + musical key
  POST /effects        — apply EQ/compression/delay/chorus/reverb
  GET  /health         — server status
"""

import io
import os
import json
import time
import tempfile
import numpy as np
import torch
import scipy
from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
from flask import Flask, request, jsonify, send_file
from transformers import AutoProcessor, MusicgenForConditionalGeneration

app = Flask(__name__)

musicgen_model = None
musicgen_processor = None
demucs_model = None
device = "cpu"

# --- Mastering Engine ---

def auto_master(audio_segment: AudioSegment) -> AudioSegment:
    audio = normalize(audio_segment)
    audio = compress_dynamic_range(audio, threshold=-20.0, ratio=4.0, attack=5.0, release=50.0)
    audio = audio.low_pass_filter(200).apply_gain(2) + audio.high_pass_filter(200)
    target_lufs = -14.0
    gain_needed = target_lufs - audio.dBFS
    audio = audio.apply_gain(gain_needed)
    if audio.max > audio.max_possible_amplitude * 0.89:
        audio = audio.apply_gain(-1)
    audio = audio.fade_in(50).fade_out(100)
    return audio

def segment_to_format(audio: AudioSegment, fmt: str = "wav") -> tuple[io.BytesIO, str, str]:
    buf = io.BytesIO()
    if fmt == "mp3":
        audio.export(buf, format="mp3", bitrate="320k", parameters=["-q:a", "0"])
        return buf, "audio/mpeg", "mp3"
    else:
        audio.export(buf, format="wav")
        return buf, "audio/wav", "wav"

# --- Stem Separation (Demucs) ---

def separate_stems(audio_path: str, output_dir: str) -> dict[str, str]:
    """Separate audio into stems using Demucs. Returns dict of stem_name -> file_path."""
    import demucs.separate

    # Run demucs separation
    demucs.separate.main([
        "--two-stems", "vocals",  # First pass: vocals vs instrumental
        "-n", "htdemucs",
        "--out", output_dir,
        audio_path,
    ])

    # Run again for drums/bass/other
    demucs.separate.main([
        "-n", "htdemucs",
        "--out", output_dir,
        audio_path,
    ])

    # Find output files
    basename = os.path.splitext(os.path.basename(audio_path))[0]
    stems_dir = os.path.join(output_dir, "htdemucs", basename)

    stems = {}
    for stem_name in ["drums", "bass", "vocals", "other"]:
        stem_path = os.path.join(stems_dir, f"{stem_name}.wav")
        if os.path.exists(stem_path):
            stems[stem_name] = stem_path

    return stems

def apply_reverb(audio: AudioSegment, amount: float = 0.3) -> AudioSegment:
    """Simple reverb via delayed copy mixing."""
    if amount <= 0:
        return audio
    # Create delayed copies at different times
    delays = [30, 60, 90, 120]
    reverb = audio
    for i, delay_ms in enumerate(delays):
        decay = amount * (0.6 ** i)  # Each reflection is quieter
        delayed = AudioSegment.silent(duration=delay_ms) + audio
        delayed = delayed[:len(audio)]  # Trim to same length
        delayed = delayed - (20 * (1 - decay))  # Reduce volume
        reverb = reverb.overlay(delayed)
    return reverb

def pan_audio(audio: AudioSegment, pan: float = 0.0) -> AudioSegment:
    """Pan audio left (-1.0) to right (1.0)."""
    if pan == 0 or audio.channels < 2:
        return audio
    return audio.pan(pan)

def apply_eq(audio: AudioSegment, low_gain: float = 0, mid_gain: float = 0, high_gain: float = 0) -> AudioSegment:
    """3-band parametric EQ. Gains in dB."""
    low = audio.low_pass_filter(300).apply_gain(low_gain)
    mid_band = audio.high_pass_filter(300).low_pass_filter(4000).apply_gain(mid_gain)
    high = audio.high_pass_filter(4000).apply_gain(high_gain)
    return low.overlay(mid_band).overlay(high)

def apply_compression(audio: AudioSegment, threshold: float = -20, ratio: float = 4.0, attack: float = 5.0, release: float = 50.0) -> AudioSegment:
    return compress_dynamic_range(audio, threshold=threshold, ratio=ratio, attack=attack, release=release)

def apply_delay(audio: AudioSegment, delay_ms: int = 300, feedback: float = 0.4, mix: float = 0.3) -> AudioSegment:
    result = audio
    delayed = audio
    for i in range(4):
        silence = AudioSegment.silent(duration=delay_ms)
        delayed = silence + delayed
        delayed = delayed[:len(audio)]
        decay = feedback ** (i + 1)
        delayed_quiet = delayed - (20 * (1 - decay))
        result = result.overlay(delayed_quiet)
    # Wet/dry mix
    dry_gain = 1 - mix
    wet_gain = mix
    return audio.apply_gain(20 * np.log10(dry_gain + 0.001)).overlay(result.apply_gain(20 * np.log10(wet_gain + 0.001)))

def apply_chorus(audio: AudioSegment, depth: float = 0.3) -> AudioSegment:
    if depth <= 0: return audio
    # Create slightly pitch-shifted copies
    shifted_up = audio._spawn(audio.raw_data, overrides={"frame_rate": int(audio.frame_rate * 1.003)}).set_frame_rate(audio.frame_rate)
    shifted_down = audio._spawn(audio.raw_data, overrides={"frame_rate": int(audio.frame_rate * 0.997)}).set_frame_rate(audio.frame_rate)
    # Ensure same length
    shifted_up = shifted_up[:len(audio)]
    shifted_down = shifted_down[:len(audio)]
    chorus = audio.overlay(shifted_up - (10 * (1-depth))).overlay(shifted_down - (10 * (1-depth)))
    return chorus

def detect_bpm(audio: AudioSegment) -> float:
    """Detect BPM using onset detection."""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    if audio.channels == 2:
        samples = samples.reshape((-1, 2)).mean(axis=1)
    # Energy-based onset detection
    hop = int(audio.frame_rate * 0.01)  # 10ms hops
    energy = np.array([np.sum(samples[i:i+hop]**2) for i in range(0, len(samples) - hop, hop)])
    # Diff of energy = onsets
    onset = np.diff(energy)
    onset[onset < 0] = 0
    onset = onset / (onset.max() + 1e-8)
    # Find peaks
    threshold = 0.3
    peaks = []
    for i in range(1, len(onset) - 1):
        if onset[i] > threshold and onset[i] > onset[i-1] and onset[i] > onset[i+1]:
            peaks.append(i)
    if len(peaks) < 2:
        return 120.0  # Default
    # Calculate intervals
    intervals = np.diff(peaks) * 0.01  # Convert to seconds
    avg_interval = np.median(intervals)
    bpm = 60.0 / avg_interval if avg_interval > 0 else 120.0
    # Normalize to reasonable range
    while bpm < 60: bpm *= 2
    while bpm > 200: bpm /= 2
    return round(bpm, 1)

def detect_key(audio: AudioSegment) -> dict:
    """Detect musical key using chroma analysis."""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    if audio.channels == 2:
        samples = samples.reshape((-1, 2)).mean(axis=1)
    sr = audio.frame_rate
    # Simple FFT-based chroma
    n_fft = 4096
    chroma_sum = np.zeros(12)
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    for start in range(0, len(samples) - n_fft, n_fft):
        frame = samples[start:start + n_fft]
        spectrum = np.abs(np.fft.rfft(frame))
        freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
        for i, freq in enumerate(freqs):
            if freq < 60 or freq > 5000: continue
            note = int(round(12 * np.log2(freq / 440.0 + 1e-8))) % 12
            chroma_sum[note] += spectrum[i]
    # Major and minor profiles (Krumhansl-Kessler)
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    best_corr = -1
    best_key = 'C'
    best_mode = 'major'
    chroma_norm = chroma_sum / (chroma_sum.max() + 1e-8)
    for shift in range(12):
        rotated = np.roll(chroma_norm, -shift)
        maj_corr = np.corrcoef(rotated, major_profile)[0, 1]
        min_corr = np.corrcoef(rotated, minor_profile)[0, 1]
        if maj_corr > best_corr:
            best_corr = maj_corr
            best_key = note_names[shift]
            best_mode = 'major'
        if min_corr > best_corr:
            best_corr = min_corr
            best_key = note_names[shift]
            best_mode = 'minor'
    return {"key": best_key, "mode": best_mode, "confidence": round(float(best_corr), 2)}

# --- Model Loading ---

def load_musicgen():
    global musicgen_model, musicgen_processor, device
    if torch.backends.mps.is_available():
        device = "mps"
    print(f"Loading MusicGen on {device.upper()}...")
    musicgen_processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
    musicgen_model = MusicgenForConditionalGeneration.from_pretrained(
        "facebook/musicgen-small", attn_implementation="eager"
    ).to(device)
    print("MusicGen ready!")

# --- Routes ---

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "musicgen": musicgen_model is not None,
        "device": device,
        "features": ["generate", "master", "separate", "mix", "analyze", "effects", "eq", "compression", "delay", "chorus", "reverb", "bpm", "key", "mp3", "wav"],
    })

@app.route("/generate", methods=["POST"])
def generate():
    if musicgen_model is None:
        return jsonify({"error": "Model not loaded"}), 503

    data = request.get_json()
    prompt = data.get("prompt", "lo-fi chill beats")
    duration = min(data.get("duration", 30), 30)
    output_format = data.get("format", "wav")
    master = data.get("master", True)

    print(f"[Generate] '{prompt}' ({duration}s, {output_format}, master={master})")
    start = time.time()

    try:
        max_tokens = int(duration * 50)
        inputs = musicgen_processor(text=[prompt], padding=True, return_tensors="pt").to(device)

        with torch.no_grad():
            audio_values = musicgen_model.generate(**inputs, max_new_tokens=max_tokens, do_sample=True)

        audio_data = audio_values[0, 0].cpu().float().numpy()
        audio_data = audio_data / (np.abs(audio_data).max() + 1e-8)
        audio_int16 = (audio_data * 32767).astype(np.int16)
        sample_rate = musicgen_model.config.audio_encoder.sampling_rate

        wav_buf = io.BytesIO()
        scipy.io.wavfile.write(wav_buf, rate=sample_rate, data=audio_int16)
        wav_buf.seek(0)
        audio_seg = AudioSegment.from_wav(wav_buf)

        if master:
            audio_seg = auto_master(audio_seg)

        out_buf, mimetype, ext = segment_to_format(audio_seg, output_format)
        out_buf.seek(0)

        print(f"[Generate] Done in {time.time() - start:.1f}s → {ext}")
        return send_file(out_buf, mimetype=mimetype, download_name=f"track.{ext}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/master", methods=["POST"])
def master_audio():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    output_format = request.form.get("format", "wav")

    print(f"[Master] Processing: {file.filename}")
    start = time.time()

    try:
        if file.filename and file.filename.endswith(".mp3"):
            audio_seg = AudioSegment.from_mp3(file)
        else:
            audio_seg = AudioSegment.from_wav(file)

        mastered = auto_master(audio_seg)
        out_buf, mimetype, ext = segment_to_format(mastered, output_format)
        out_buf.seek(0)

        print(f"[Master] Done in {time.time() - start:.1f}s")
        return send_file(out_buf, mimetype=mimetype, download_name=f"mastered.{ext}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/separate", methods=["POST"])
def separate():
    """Separate uploaded audio into stems (drums, bass, vocals, other)."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    output_format = request.form.get("format", "wav")

    print(f"[Separate] Processing: {file.filename}")
    start = time.time()

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save uploaded file
            input_path = os.path.join(tmpdir, "input.wav")
            if file.filename and file.filename.endswith(".mp3"):
                audio = AudioSegment.from_mp3(file)
            else:
                audio = AudioSegment.from_wav(file)
            audio.export(input_path, format="wav")

            # Run Demucs separation
            output_dir = os.path.join(tmpdir, "output")
            os.makedirs(output_dir, exist_ok=True)

            import demucs.separate
            demucs.separate.main([
                "-n", "htdemucs",
                "--out", output_dir,
                input_path,
            ])

            # Collect stems
            stems_dir = os.path.join(output_dir, "htdemucs", "input")
            result_stems = {}

            for stem_name in ["drums", "bass", "vocals", "other"]:
                stem_path = os.path.join(stems_dir, f"{stem_name}.wav")
                if os.path.exists(stem_path):
                    stem_audio = AudioSegment.from_wav(stem_path)
                    buf, _, ext = segment_to_format(stem_audio, output_format)
                    buf.seek(0)

                    import base64
                    audio_b64 = base64.b64encode(buf.read()).decode("utf-8")
                    result_stems[stem_name] = {
                        "data": audio_b64,
                        "format": ext,
                        "duration_ms": len(stem_audio),
                    }

            elapsed = time.time() - start
            print(f"[Separate] Done in {elapsed:.1f}s — {len(result_stems)} stems")

            return jsonify({
                "stems": result_stems,
                "stem_names": list(result_stems.keys()),
                "duration_ms": len(audio),
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/mix", methods=["POST"])
def mix_stems():
    """
    Mix stems together with volume, pan, and reverb controls.
    Expects JSON with base64 stem data and mix parameters.
    """
    data = request.get_json()
    stems_data = data.get("stems", {})
    output_format = data.get("format", "mp3")
    master_output = data.get("master", True)

    if not stems_data:
        return jsonify({"error": "No stems provided"}), 400

    print(f"[Mix] Mixing {len(stems_data)} stems")
    start = time.time()

    try:
        import base64

        mixed = None

        for stem_name, stem_config in stems_data.items():
            audio_b64 = stem_config.get("data", "")
            volume = stem_config.get("volume", 0)       # dB adjustment (-20 to +10)
            pan_val = stem_config.get("pan", 0.0)        # -1.0 (left) to 1.0 (right)
            reverb_amt = stem_config.get("reverb", 0.0)  # 0.0 to 1.0
            mute = stem_config.get("mute", False)

            if mute or not audio_b64:
                continue

            # Decode audio
            audio_bytes = base64.b64decode(audio_b64)
            buf = io.BytesIO(audio_bytes)

            fmt = stem_config.get("format", "wav")
            if fmt == "mp3":
                stem_audio = AudioSegment.from_mp3(buf)
            else:
                stem_audio = AudioSegment.from_wav(buf)

            # Apply volume
            if volume != 0:
                stem_audio = stem_audio + volume

            # Apply pan
            if pan_val != 0:
                stem_audio = pan_audio(stem_audio, pan_val)

            # Apply reverb
            if reverb_amt > 0:
                stem_audio = apply_reverb(stem_audio, reverb_amt)

            # Apply EQ
            if "eq" in stem_config:
                eq = stem_config["eq"]
                stem_audio = apply_eq(stem_audio, eq.get("low", 0), eq.get("mid", 0), eq.get("high", 0))

            # Apply compression
            if "compression" in stem_config:
                comp = stem_config["compression"]
                stem_audio = apply_compression(stem_audio, comp.get("threshold", -20), comp.get("ratio", 4.0))

            # Apply delay
            if "delay" in stem_config:
                d = stem_config["delay"]
                stem_audio = apply_delay(stem_audio, d.get("time", 300), d.get("feedback", 0.4), d.get("mix", 0.3))

            # Apply chorus
            if "chorus" in stem_config:
                stem_audio = apply_chorus(stem_audio, stem_config["chorus"].get("depth", 0.3))

            # Mix into output
            if mixed is None:
                mixed = stem_audio
            else:
                # Ensure same length
                if len(stem_audio) > len(mixed):
                    mixed = mixed + AudioSegment.silent(duration=len(stem_audio) - len(mixed))
                elif len(mixed) > len(stem_audio):
                    stem_audio = stem_audio + AudioSegment.silent(duration=len(mixed) - len(stem_audio))
                mixed = mixed.overlay(stem_audio)

        if mixed is None:
            return jsonify({"error": "All stems are muted"}), 400

        # Auto-master the final mix
        if master_output:
            mixed = auto_master(mixed)

        out_buf, mimetype, ext = segment_to_format(mixed, output_format)
        out_buf.seek(0)

        elapsed = time.time() - start
        print(f"[Mix] Done in {elapsed:.1f}s → {ext}")

        return send_file(out_buf, mimetype=mimetype, download_name=f"mix.{ext}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/analyze", methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    try:
        if file.filename and file.filename.endswith(".mp3"):
            audio = AudioSegment.from_mp3(file)
        else:
            audio = AudioSegment.from_wav(file)
        bpm = detect_bpm(audio)
        key_info = detect_key(audio)
        return jsonify({"bpm": bpm, "key": key_info["key"], "mode": key_info["mode"], "confidence": key_info["confidence"], "duration_ms": len(audio), "channels": audio.channels, "sample_rate": audio.frame_rate})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/effects", methods=["POST"])
def apply_effects_route():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    output_format = request.form.get("format", "wav")
    effects_json = request.form.get("effects", "{}")
    effects = json.loads(effects_json)
    try:
        if file.filename and file.filename.endswith(".mp3"):
            audio = AudioSegment.from_mp3(file)
        else:
            audio = AudioSegment.from_wav(file)
        # Apply each effect
        if "eq" in effects:
            eq = effects["eq"]
            audio = apply_eq(audio, eq.get("low", 0), eq.get("mid", 0), eq.get("high", 0))
        if "compression" in effects:
            comp = effects["compression"]
            audio = apply_compression(audio, comp.get("threshold", -20), comp.get("ratio", 4.0), comp.get("attack", 5.0), comp.get("release", 50.0))
        if "delay" in effects:
            d = effects["delay"]
            audio = apply_delay(audio, d.get("time", 300), d.get("feedback", 0.4), d.get("mix", 0.3))
        if "chorus" in effects:
            audio = apply_chorus(audio, effects["chorus"].get("depth", 0.3))
        if "reverb" in effects:
            audio = apply_reverb(audio, effects["reverb"].get("amount", 0.3))
        out_buf, mimetype, ext = segment_to_format(audio, output_format)
        out_buf.seek(0)
        return send_file(out_buf, mimetype=mimetype, download_name=f"processed.{ext}")
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    load_musicgen()
    print(f"\n=== SoundMint Music Server ({device.upper()}) ===")
    print("POST /generate   — generate + auto-master music")
    print("POST /master     — master uploaded audio")
    print("POST /separate   — stem separation (drums/bass/vocals/other)")
    print("POST /mix        — mix stems with volume/pan/reverb")
    print("POST /analyze    — detect BPM + musical key")
    print("POST /effects    — apply EQ/compression/delay/chorus/reverb")
    print("GET  /health     — server status")
    print(f"http://localhost:8501\n")
    app.run(host="0.0.0.0", port=8501, debug=False)
