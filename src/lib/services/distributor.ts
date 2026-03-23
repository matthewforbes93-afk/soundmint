import { DistributionPlatform, Track } from '../types';

interface DistributionRequest {
  track: Track;
  platforms: DistributionPlatform[];
  cover_art_url: string;
  release_date?: string;
  upc?: string;
  isrc?: string;
}

interface DistributionResult {
  platform: DistributionPlatform;
  status: 'submitted' | 'failed';
  external_id?: string;
  error?: string;
}

export async function publishToDistroKid(request: DistributionRequest): Promise<DistributionResult[]> {
  const results: DistributionResult[] = [];

  try {
    const response = await fetch(`${process.env.DISTROKID_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DISTROKID_API_KEY}`,
      },
      body: JSON.stringify({
        title: request.track.title,
        artist: request.track.artist_name,
        audio_url: request.track.audio_url,
        cover_art_url: request.cover_art_url,
        genre: request.track.genre,
        release_date: request.release_date || new Date().toISOString().split('T')[0],
        platforms: request.platforms,
        upc: request.upc,
        isrc: request.isrc,
        is_ai_generated: true,
        language: 'en',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      request.platforms.forEach(platform => {
        results.push({ platform, status: 'failed', error });
      });
      return results;
    }

    const data = await response.json();
    request.platforms.forEach(platform => {
      results.push({
        platform,
        status: 'submitted',
        external_id: data.release_id,
      });
    });
  } catch (error) {
    request.platforms.forEach(platform => {
      results.push({
        platform,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  return results;
}

export async function checkDistributionStatus(releaseId: string): Promise<{
  status: 'processing' | 'live' | 'rejected';
  platforms: Record<string, { status: string; url?: string }>;
}> {
  const response = await fetch(`${process.env.DISTROKID_API_URL}/release/${releaseId}/status`, {
    headers: {
      'Authorization': `Bearer ${process.env.DISTROKID_API_KEY}`,
    },
  });

  if (!response.ok) throw new Error('Failed to check distribution status');
  return response.json();
}

export async function generateCoverArt(
  title: string,
  genre: string,
  mood: string
): Promise<string> {
  const prompt = `Album cover art for a ${mood} ${genre} track called "${title}". Modern, artistic, visually striking. No text.`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) throw new Error('Failed to generate cover art');
  const data = await response.json();
  return data.data[0].url;
}
