'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Library, Search, Trash2, Sliders, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProjectItem {
  id: string;
  title: string;
  artist: string;
  status: string;
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
    if (res.ok) { setProjects(p => p.filter(x => x.id !== id)); toast.success('Deleted'); }
  }

  const filtered = projects.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-gray-700 text-sm mt-1">{projects.length} projects</p>
        </div>
        <Link href="/session"
          className="flex items-center gap-2 text-sm px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-xl text-white font-medium transition-colors">
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder:text-gray-800 focus:outline-none focus:border-teal-500/30" />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-800">Loading...</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-1">
          {filtered.map(p => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/[0.02] transition-colors group">
              <div>
                <p className="text-sm font-medium text-white">{p.title}</p>
                <p className="text-xs text-gray-700">{p.artist} · {new Date(p.updated_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/studio?project=${p.id}`}
                  className="text-[11px] px-2.5 py-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center gap-1">
                  <Sliders className="w-3 h-3" /> Open
                </Link>
                <button onClick={() => deleteProject(p.id)}
                  className="text-[11px] px-2.5 py-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/5 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Library className="w-12 h-12 text-gray-900 mx-auto mb-3" />
          <p className="text-gray-700">{search ? 'No matches' : 'No projects yet'}</p>
        </div>
      )}
    </div>
  );
}
