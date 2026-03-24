import { GenerationRequest, Track } from '../types';
import { createServerClient } from '../supabase';

interface GenerationResult {
  external_id: string;
  audio_url: string;
  duration_seconds: number;
}

// Meta MusicGen via Hugging Face Inference API (FREE)
async function generateWithMusicGen(request: GenerationRequest): Promise<GenerationResult> {
  const prompt = `${request.genre} ${request.mood} ${request.prompt}`.trim();

  // Try HuggingFace first, fall back to Replicate
  let audioBuffer: ArrayBuffer;

  try {
    audioBuffer = await generateViaHuggingFace(prompt);
  } catch (hfError) {
    console.log('HuggingFace failed, trying Replicate:', hfError);
    if (process.env.REPLICATE_API_KEY) {
      audioBuffer = await generateViaReplicate(prompt);
    } else {
      throw hfError;
    }
  }

  // Upload to Supabase Storage
  const supabase = createServerClient();
  const filename = `tracks/${Date.now()}-${Math.random().toString(36).slice(2)}.wav`;

  const { error: uploadError } = await supabase.storage
    .from('audio')
    .upload(filename, Buffer.from(audioBuffer), {
      contentType: 'audio/wav',
      upsert: false,
    });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

  return {
    external_id: `musicgen-${Date.now()}`,
    audio_url: urlData.publicUrl,
    duration_seconds: 30,
  };
}

async function generateViaHuggingFace(prompt: string): Promise<ArrayBuffer> {
  const response = await fetch(
    'https://router.huggingface.co/hf-inference/models/facebook/musicgen-small',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HuggingFace error: ${response.status} - ${errText}`);
  }

  return response.arrayBuffer();
}

async function generateViaReplicate(prompt: string): Promise<ArrayBuffer> {
  // Start prediction
  const startRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`,
    },
    body: JSON.stringify({
      version: 'b05b1dff1d8c6dc63d14b0cdb42135571e41c36ba4e4b09f8b2d0c6e6f2e8d29',
      input: {
        prompt,
        duration: 30,
        model_version: 'stereo-melody-large',
        output_format: 'wav',
      },
    }),
  });

  if (!startRes.ok) throw new Error(`Replicate start error: ${startRes.status}`);
  const prediction = await startRes.json();

  // Poll for completion (max 2 minutes)
  let result = prediction;
  for (let i = 0; i < 24; i++) {
    if (result.status === 'succeeded') break;
    if (result.status === 'failed') throw new Error('Replicate generation failed');

    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(result.urls.get, {
      headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}` },
    });
    result = await pollRes.json();
  }

  if (result.status !== 'succeeded') throw new Error('Replicate generation timed out');

  // Download the audio
  const audioRes = await fetch(result.output);
  return audioRes.arrayBuffer();
}

// Suno API integration (paid)
async function generateWithSuno(request: GenerationRequest): Promise<GenerationResult> {
  const response = await fetch(`${process.env.SUNO_API_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: `${request.genre} ${request.mood} ${request.prompt}`,
      make_instrumental: !request.with_vocals,
      custom_lyrics: request.lyrics || undefined,
      duration: request.duration || 180,
    }),
  });

  if (!response.ok) throw new Error(`Suno API error: ${response.status}`);
  const data = await response.json();

  return {
    external_id: data.id,
    audio_url: data.audio_url,
    duration_seconds: data.duration || 180,
  };
}

// Stable Audio API integration (paid)
async function generateWithStableAudio(request: GenerationRequest): Promise<GenerationResult> {
  const response = await fetch('https://api.stability.ai/v2beta/audio/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STABLE_AUDIO_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: `${request.genre}, ${request.mood} mood, ${request.prompt}`,
      duration: request.duration || 30,
      output_format: 'mp3',
    }),
  });

  if (!response.ok) throw new Error(`Stable Audio API error: ${response.status}`);
  const data = await response.json();

  return {
    external_id: data.id,
    audio_url: data.audio_url,
    duration_seconds: data.duration || 30,
  };
}

// Loudly API integration (paid)
async function generateWithLoudly(request: GenerationRequest): Promise<GenerationResult> {
  const response = await fetch('https://api.loudly.com/v1/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LOUDLY_API_KEY}`,
    },
    body: JSON.stringify({
      genre: request.genre,
      mood: request.mood,
      duration: request.duration || 120,
      description: request.prompt,
    }),
  });

  if (!response.ok) throw new Error(`Loudly API error: ${response.status}`);
  const data = await response.json();

  return {
    external_id: data.track_id,
    audio_url: data.download_url,
    duration_seconds: data.duration || 120,
  };
}

// Main generator - defaults to MusicGen (free)
export async function generateTrack(request: GenerationRequest): Promise<GenerationResult> {
  const provider = request.ai_provider || 'musicgen';

  switch (provider) {
    case 'musicgen':
      return generateWithMusicGen(request);
    case 'suno':
      return generateWithSuno(request);
    case 'stable_audio':
      return generateWithStableAudio(request);
    case 'loudly':
      return generateWithLoudly(request);
    default:
      return generateWithMusicGen(request);
  }
}

export async function pollGenerationStatus(
  provider: Track['ai_provider'],
  externalId: string
): Promise<{ status: 'pending' | 'complete' | 'failed'; audio_url?: string }> {
  // MusicGen is synchronous - no polling needed
  if (provider === 'musicgen') {
    return { status: 'complete' };
  }

  const urls: Record<string, string> = {
    suno: `${process.env.SUNO_API_URL}/api/status/${externalId}`,
    stable_audio: `https://api.stability.ai/v2beta/audio/status/${externalId}`,
    loudly: `https://api.loudly.com/v1/status/${externalId}`,
  };

  const keys: Record<string, string | undefined> = {
    suno: process.env.SUNO_API_KEY,
    stable_audio: process.env.STABLE_AUDIO_API_KEY,
    loudly: process.env.LOUDLY_API_KEY,
  };

  const response = await fetch(urls[provider] || urls.suno, {
    headers: { 'Authorization': `Bearer ${keys[provider] || ''}` },
  });

  if (!response.ok) return { status: 'failed' };
  const data = await response.json();

  if (data.status === 'complete' || data.status === 'succeeded') {
    return { status: 'complete', audio_url: data.audio_url || data.output_url };
  }
  if (data.status === 'failed' || data.status === 'error') {
    return { status: 'failed' };
  }
  return { status: 'pending' };
}
