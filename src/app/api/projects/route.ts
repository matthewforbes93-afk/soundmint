import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, artist, status, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const project = await request.json();

  const { error } = await supabase.from('projects').upsert({
    id: project.id,
    title: project.title,
    artist: project.artist,
    data: project,
    status: 'draft',
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: project.id }, { status: 201 });
}
