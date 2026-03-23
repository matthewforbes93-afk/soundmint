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

  const response = await fetch(
    'https://api-inference.huggingface.co/models/facebook/musicgen-large',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 1500, // ~30s of audio
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`MusicGen API error: ${response.status} - ${errText}`);
  }

  // HF returns raw audio bytes
  const audioBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString('base64');

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
