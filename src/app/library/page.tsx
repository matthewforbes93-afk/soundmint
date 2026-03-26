'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Library, Search, Trash2, Sliders, Plus } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface ProjectItem {
  id: string;
  title: string;
  artist: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function LibraryPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProjects(d);
    }).finally(() => setLoading(false));
  }, []);

  async function deleteProject(id: string) {
    if (!confirm('Delete this project?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects(p => p.filter(x => x.id !== id));
      toast.success('Deleted');
    }
  }

  const filtered = projects.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Library className="w-6 h-6 text-teal-500" /> Library
          </h1>
          <p className="text-gray-500 text-sm mt-1">{projects.length} projects</p>
        </div>
        <Link href="/session">
          <Button icon={<Plus className="w-4 h-4" />}>New Project</Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-gray-700 focus:outline-none focus:border-teal-500/50" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-600">Loading...</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} padding="sm" className="flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium text-white">{p.title}</p>
                <p className="text-xs text-gray-600">{p.artist} · {p.status} · {new Date(p.updated_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/studio?project=${p.id}`}>
                  <Button variant="ghost" size="sm" icon={<Sliders className="w-3 h-3" />}>Open</Button>
                </Link>
                <Button variant="ghost" size="sm" icon={<Trash2 className="w-3 h-3" />} onClick={() => deleteProject(p.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Library className="w-12 h-12 text-gray-800 mx-auto mb-3" />
          <p className="text-gray-500">{search ? 'No matches' : 'No projects yet'}</p>
        </Card>
      )}
    </div>
  );
}
