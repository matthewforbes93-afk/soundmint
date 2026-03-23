import { GenerationRequest, Track } from '../types';

interface GenerationResult {
  external_id: string;
  audio_url: string;
  duration_seconds: number;
}

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

export async function generateTrack(request: GenerationRequest): Promise<GenerationResult> {
  const provider = request.ai_provider || 'suno';

  switch (provider) {
    case 'suno':
      return generateWithSuno(request);
    case 'stable_audio':
      return generateWithStableAudio(request);
    case 'loudly':
      return generateWithLoudly(request);
    default:
      return generateWithSuno(request);
  }
}

export async function pollGenerationStatus(
  provider: Track['ai_provider'],
  externalId: string
): Promise<{ status: 'pending' | 'complete' | 'failed'; audio_url?: string }> {
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
