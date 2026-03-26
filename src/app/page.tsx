'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Disc3, Sliders, Library, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface ProjectSummary {
  id: string;
  title: string;
  artist: string;
  updated_at: string;
}

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setProjects(d.slice(0, 5));
    }).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2 tracking-tight">
          Sound<span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">Mint</span>
        </h1>
        <p className="text-gray-500">Create. Produce. Distribute.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-12">
        {[
          { href: '/session', icon: Disc3, label: 'Create', desc: 'Start a new session', color: 'from-teal-600 to-emerald-600' },
          { href: '/studio', icon: Sliders, label: 'Studio', desc: 'Open the DAW', color: 'from-cyan-600 to-teal-600' },
          { href: '/library', icon: Library, label: 'Library', desc: 'Your projects', color: 'from-violet-600 to-purple-600' },
        ].map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-white/10 transition-all hover:scale-[1.02] cursor-pointer">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white">{label}</h3>
              <p className="text-xs text-gray-600 mt-1">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      {projects.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
          <div className="space-y-2">
            {projects.map(p => (
              <Link key={p.id} href={`/studio?project=${p.id}`}>
                <Card padding="sm" className="flex items-center justify-between hover:border-white/10 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-gray-600">{p.artist} · {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <Card className="text-center py-12">
          <Disc3 className="w-12 h-12 text-gray-800 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No projects yet</p>
          <Link href="/session">
            <Button>Create Your First Track</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
