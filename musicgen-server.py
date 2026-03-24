"""
SoundMint Local Music Server
- MusicGen: instrumental music generation (Meta)
- Demucs: stem separation (Meta) — drums, bass, vocals, other
- Auto-mastering: loudness normalization, EQ, compression
- Mixing: per-stem volume, pan, reverb
- MP3/WAV output
Endpoints:
  POST /generate       — generate music
  POST /master         — master uploaded audio
  POST /separate       — separate audio into stems
  POST /mix            — mix stems with volume/pan/reverb controls
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
        "features": ["generate", "master", "separate", "mix", "mp3", "wav"],
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

if __name__ == "__main__":
    load_musicgen()
    print(f"\n=== SoundMint Music Server ({device.upper()}) ===")
    print("POST /generate   — generate + auto-master music")
    print("POST /master     — master uploaded audio")
    print("POST /separate   — stem separation (drums/bass/vocals/other)")
    print("POST /mix        — mix stems with volume/pan/reverb")
    print("GET  /health     — server status")
    print(f"http://localhost:8501\n")
    app.run(host="0.0.0.0", port=8501, debug=False)
