"""
SoundMint Local Music Server
- MusicGen: instrumental music generation (Meta)
- Auto-mastering: loudness normalization, EQ, compression
- MP3/WAV output format support
Endpoints:
  POST /generate       — generate music (supports format=mp3|wav)
  POST /master         — master an uploaded audio file
  GET  /health         — server status
"""

import io
import time
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
device = "cpu"

# --- Mastering Engine ---

def auto_master(audio_segment: AudioSegment) -> AudioSegment:
    """
    Auto-master audio for streaming platforms.
    Targets -14 LUFS (Spotify/Apple Music standard).
    """
    # 1. Normalize peak levels
    audio = normalize(audio_segment)

    # 2. Apply gentle compression (reduces dynamic range for consistent loudness)
    audio = compress_dynamic_range(
        audio,
        threshold=-20.0,   # Start compressing above -20 dB
        ratio=4.0,         # 4:1 compression ratio
        attack=5.0,        # 5ms attack
        release=50.0,      # 50ms release
    )

    # 3. EQ boost: subtle low-end warmth + high-end presence
    # Bass boost (slight): +2dB below 200Hz
    audio = audio.low_pass_filter(200).apply_gain(2) + audio.high_pass_filter(200)

    # 4. Final loudness normalization to -14 LUFS (streaming standard)
    target_lufs = -14.0
    current_loudness = audio.dBFS
    gain_needed = target_lufs - current_loudness
    audio = audio.apply_gain(gain_needed)

    # 5. Limiter: hard clip at -1 dB to prevent distortion
    max_amplitude = audio.max_possible_amplitude
    if audio.max > max_amplitude * 0.89:  # -1 dB
        audio = audio.apply_gain(-1)

    # 6. Fade in/out to prevent clicks
    audio = audio.fade_in(50).fade_out(100)

    return audio

def wav_bytes_to_segment(wav_bytes: bytes) -> AudioSegment:
    """Convert WAV bytes to AudioSegment."""
    return AudioSegment.from_wav(io.BytesIO(wav_bytes))

def segment_to_format(audio: AudioSegment, fmt: str = "wav") -> tuple[io.BytesIO, str, str]:
    """Export AudioSegment to specified format, returns (buffer, mimetype, extension)."""
    buf = io.BytesIO()
    if fmt == "mp3":
        audio.export(buf, format="mp3", bitrate="320k", parameters=["-q:a", "0"])
        return buf, "audio/mpeg", "mp3"
    else:
        audio.export(buf, format="wav")
        return buf, "audio/wav", "wav"

# --- Model Loading ---

def load_musicgen():
    global musicgen_model, musicgen_processor, device

    if torch.backends.mps.is_available():
        device = "mps"
    print(f"Loading MusicGen on {device.upper()}...")

    musicgen_processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
    musicgen_model = MusicgenForConditionalGeneration.from_pretrained(
        "facebook/musicgen-small",
        attn_implementation="eager"
    ).to(device)

    print("MusicGen ready!")

# --- Routes ---

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "musicgen": musicgen_model is not None,
        "device": device,
        "features": ["generate", "master", "mp3", "wav"],
    })

@app.route("/generate", methods=["POST"])
def generate():
    if musicgen_model is None:
        return jsonify({"error": "Model not loaded"}), 503

    data = request.get_json()
    prompt = data.get("prompt", "lo-fi chill beats")
    duration = min(data.get("duration", 30), 30)
    output_format = data.get("format", "wav")  # wav or mp3
    master = data.get("master", True)  # auto-master by default

    print(f"[Generate] '{prompt}' ({duration}s, {output_format}, master={master})")
    start = time.time()

    try:
        max_tokens = int(duration * 50)
        inputs = musicgen_processor(text=[prompt], padding=True, return_tensors="pt").to(device)

        with torch.no_grad():
            audio_values = musicgen_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=True,
            )

        audio_data = audio_values[0, 0].cpu().float().numpy()

        # Normalize to int16
        audio_data = audio_data / (np.abs(audio_data).max() + 1e-8)
        audio_int16 = (audio_data * 32767).astype(np.int16)

        sample_rate = musicgen_model.config.audio_encoder.sampling_rate

        # Convert to AudioSegment for processing
        wav_buf = io.BytesIO()
        scipy.io.wavfile.write(wav_buf, rate=sample_rate, data=audio_int16)
        wav_buf.seek(0)
        audio_seg = AudioSegment.from_wav(wav_buf)

        # Auto-master if requested
        if master:
            audio_seg = auto_master(audio_seg)
            print(f"[Master] Applied auto-mastering (-14 LUFS target)")

        # Export in requested format
        out_buf, mimetype, ext = segment_to_format(audio_seg, output_format)
        out_buf.seek(0)

        elapsed = time.time() - start
        print(f"[Generate] Done in {elapsed:.1f}s → {ext}")

        return send_file(out_buf, mimetype=mimetype, download_name=f"track.{ext}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/master", methods=["POST"])
def master_audio():
    """Master an uploaded audio file."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send as multipart with key 'file'"}), 400

    file = request.files["file"]
    output_format = request.form.get("format", "wav")

    print(f"[Master] Processing uploaded file: {file.filename}")
    start = time.time()

    try:
        # Detect input format
        if file.filename and file.filename.endswith(".mp3"):
            audio_seg = AudioSegment.from_mp3(file)
        else:
            audio_seg = AudioSegment.from_wav(file)

        # Apply mastering
        mastered = auto_master(audio_seg)

        # Export
        out_buf, mimetype, ext = segment_to_format(mastered, output_format)
        out_buf.seek(0)

        elapsed = time.time() - start
        print(f"[Master] Done in {elapsed:.1f}s → {ext}")

        return send_file(out_buf, mimetype=mimetype, download_name=f"mastered.{ext}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    load_musicgen()
    print(f"\n=== SoundMint Music Server ({device.upper()}) ===")
    print("POST /generate  — generate + auto-master music")
    print("POST /master    — master uploaded audio")
    print("GET  /health    — server status")
    print(f"http://localhost:8501\n")
    app.run(host="0.0.0.0", port=8501, debug=False)
