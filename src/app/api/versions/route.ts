import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('track_id');

  if (!trackId) {
    return NextResponse.json({ error: 'track_id required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('mix_versions')
    .select('*')
    .eq('track_id', trackId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const { track_id, name, mix_settings, audio_url } = body;

  if (!track_id) {
    return NextResponse.json({ error: 'track_id required' }, { status: 400 });
  }

  const { data, error } = await supabase.from('mix_versions').insert({
    id: uuid(),
    track_id,
    name: name || `Version ${new Date().toLocaleString()}`,
    mix_settings: mix_settings || {},
    audio_url: audio_url || null,
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
