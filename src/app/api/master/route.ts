export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const format = (formData.get('format') as string) || 'mp3';
  const trackId = formData.get('track_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    // Send to local mastering server
    const masterForm = new FormData();
    masterForm.append('file', file);
    masterForm.append('format', format);

    const response = await fetch(`${localUrl}/master`, {
      method: 'POST',
      body: masterForm,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Mastering failed: ${err}` }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload mastered file to Supabase
    const supabase = createServerClient();
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    const filename = `mastered/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, Buffer.from(audioBuffer), {
        contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

    // Update track if track_id provided
    if (trackId) {
      await supabase.from('tracks').update({
        audio_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', trackId);
    }

    return NextResponse.json({
      audio_url: urlData.publicUrl,
      format: ext,
      mastered: true,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Mastering failed',
    }, { status: 500 });
  }
}
