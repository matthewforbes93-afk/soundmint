export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuid } from 'uuid';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || 'Untitled Recording';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // Upload audio to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'webm';
    const filename = `recordings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, buffer, {
        contentType: file.type || 'audio/webm',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

    // Create track record
    const trackId = uuid();
    const { error: insertError } = await supabase.from('tracks').insert({
      id: trackId,
      title,
      artist_name: 'Me',
      genre: 'lo-fi',
      mood: 'chill',
      duration_seconds: 0,
      status: 'ready',
      audio_url: urlData.publicUrl,
      cover_art_url: null,
      prompt: 'live recording',
      ai_provider: 'musicgen',
      external_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: trackId, audio_url: urlData.publicUrl }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
    }, { status: 500 });
  }
}
