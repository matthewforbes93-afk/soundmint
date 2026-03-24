export const maxDuration = 300; // 5 min timeout for music generation

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateTrack } from '@/lib/services/music-generator';
import { generateCoverArt, publishToDistroKid } from '@/lib/services/distributor';
import { GenerationRequest } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const genre = searchParams.get('genre');

  let query = supabase.from('tracks').select('*').order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (genre && genre !== 'all') query = query.eq('genre', genre);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body: GenerationRequest = await request.json();

  const trackId = uuid();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from('tracks').insert({
    id: trackId,
    title: generateTitle(body.genre, body.mood),
    artist_name: body.artist_name,
    genre: body.genre,
    mood: body.mood,
    duration_seconds: body.duration || 180,
    status: 'generating',
    audio_url: null,
    cover_art_url: null,
    prompt: body.prompt,
    ai_provider: body.ai_provider || 'suno',
    external_id: null,
    created_at: now,
    updated_at: now,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Wait for generation (local server needs time)
  try {
    await processGeneration(supabase, trackId, body);
    const { data: track } = await supabase.from('tracks').select('*').eq('id', trackId).single();
    return NextResponse.json(track, { status: 201 });
  } catch {
    return NextResponse.json({ id: trackId, status: 'generating' }, { status: 201 });
  }
}

async function processGeneration(supabase: ReturnType<typeof createServerClient>, trackId: string, request: GenerationRequest) {
  try {
    const result = await generateTrack(request);

    // Generate cover art (skip if it fails - not critical)
    let coverArtUrl: string | null = null;
    try {
      const title = generateTitle(request.genre, request.mood);
      coverArtUrl = await generateCoverArt(title, request.genre, request.mood);
    } catch (e) {
      console.log('Cover art generation skipped:', e);
    }

    await supabase.from('tracks').update({
      status: request.auto_publish ? 'publishing' : 'ready',
      audio_url: result.audio_url,
      cover_art_url: coverArtUrl,
      external_id: result.external_id,
      duration_seconds: result.duration_seconds,
      updated_at: new Date().toISOString(),
    }).eq('id', trackId);

    if (request.auto_publish && request.platforms?.length) {
      const track = (await supabase.from('tracks').select('*').eq('id', trackId).single()).data;
      if (track) {
        const results = await publishToDistroKid({
          track,
          platforms: request.platforms,
          cover_art_url: coverArtUrl || '',
        });

        for (const dist of results) {
          await supabase.from('distributions').insert({
            id: uuid(),
            track_id: trackId,
            platform: dist.platform,
            status: dist.status === 'submitted' ? 'processing' : 'rejected',
            external_url: null,
            distributor: 'distrokid',
            submitted_at: new Date().toISOString(),
            live_at: null,
          });
        }

        await supabase.from('tracks').update({
          status: 'published',
          updated_at: new Date().toISOString(),
        }).eq('id', trackId);
      }
    }
  } catch (error) {
    console.error('Generation failed:', error);
    await supabase.from('tracks').update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', trackId);
  }
}

function generateTitle(genre: string, mood: string): string {
  const titles: Record<string, string[]> = {
    'lo-fi': ['Rainy Window', 'Midnight Study', 'Foggy Morning', 'Quiet Streets', 'Paper Lanterns'],
    'ambient': ['Horizon Line', 'Deep Space', 'Crystal Cave', 'Still Water', 'Morning Light'],
    'jazz': ['Blue Note', 'Smoke & Mirrors', 'Late Set', 'Velvet Hour', 'Quarter Note'],
    'classical': ['Opus Dawn', 'Allegro', 'Moonlit Sonata', 'Winter Passage', 'First Light'],
    'electronic': ['Neon Drive', 'Pulse', 'Binary Sunset', 'Voltage', 'Circuit'],
    'hip-hop': ['Block Party', 'Night Ride', 'Cold Pavement', 'Crown Heights', 'Gold Chain'],
    'pop': ['Sunflower', 'Daydream', 'Electric Feel', 'Kaleidoscope', 'Starlight'],
    'cinematic': ['The Awakening', 'Final Stand', 'New World', 'Echoes of Time', 'Rising Tide'],
    'meditation': ['Inner Peace', 'Lotus', 'Calm Waters', 'Breath', 'Zenith'],
    'r&b': ['Silk Sheets', 'Golden Hour', 'After Hours', 'Slow Burn', 'Midnight Call'],
    'rock': ['Thunder Road', 'Breaking Point', 'Wildfire', 'Iron Heart', 'Rebel Yell'],
    'latin': ['Fuego', 'Sol y Luna', 'Ritmo', 'Caliente', 'Verano'],
    'afrobeat': ['Lagos Nights', 'Palm Wine', 'Rhythm Nation', 'Sundown', 'Groove City'],
    'country': ['Dusty Road', 'Porch Swing', 'Open Range', 'River Bend', 'Harvest Moon'],
  };
  const genreTitles = titles[genre] || titles['ambient'];
  return genreTitles[Math.floor(Math.random() * genreTitles.length)];
}
