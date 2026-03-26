import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuid } from 'uuid';

// Save a session
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { artistName, songTitle, genre, mood, bpm, beatUrl, vocalUrl, vocalPreset, autotunePreset, beatVolume, vocalVolume, lyrics, door } = body;

  const supabase = createServerClient();
  const id = uuid();

  const { error } = await supabase.from('sessions').insert({
    id,
    artist_name: artistName,
    song_title: songTitle,
    genre,
    mood,
    bpm,
    beat_url: beatUrl,
    vocal_url: vocalUrl,
    vocal_preset: vocalPreset,
    autotune_preset: autotunePreset,
    beat_volume: beatVolume,
    vocal_volume: vocalVolume,
    lyrics: lyrics || null,
    door: door || 'record',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id }, { status: 201 });
}

// List sessions
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
