export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const effects = formData.get('effects') as string || '{}';
  const format = (formData.get('format') as string) || 'mp3';
  const trackId = formData.get('track_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const localUrl = process.env.MUSICGEN_LOCAL_URL || 'http://localhost:8501';

  try {
    const effectsForm = new FormData();
    effectsForm.append('file', file);
    effectsForm.append('effects', effects);
    effectsForm.append('format', format);

    const response = await fetch(`${localUrl}/effects`, {
      method: 'POST',
      body: effectsForm,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Effects failed: ${err}` }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();

    // Upload to Supabase
    const supabase = createServerClient();
    const ext = format === 'mp3' ? 'mp3' : 'wav';
    const filename = `processed/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, Buffer.from(audioBuffer), {
        contentType: format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filename);

    if (trackId) {
      await supabase.from('tracks').update({
        audio_url: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', trackId);
    }

    return NextResponse.json({
      audio_url: urlData.publicUrl,
      format: ext,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Effects processing failed',
    }, { status: 500 });
  }
}
