'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Disc3, Sliders, Library, ChevronRight, Music2 } from 'lucide-react';

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
      if (Array.isArray(d)) setProjects(d.slice(0, 3));
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="text-center mb-16 relative z-10">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Music2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-3">
          Sound<span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">Mint</span>
        </h1>
        <p className="text-gray-600 text-sm">Professional music studio in your browser</p>
      </div>

      {/* Three doors */}
      <div className="grid grid-cols-3 gap-6 w-full max-w-3xl relative z-10 mb-16">
        {[
          { href: '/session', icon: Disc3, label: 'Create', desc: 'Start a new session', accent: 'teal' },
          { href: '/studio', icon: Sliders, label: 'Studio', desc: 'Open the DAW', accent: 'cyan' },
          { href: '/library', icon: Library, label: 'Library', desc: 'Your projects', accent: 'violet' },
        ].map(({ href, icon: Icon, label, desc, accent }) => (
          <Link key={href} href={href}>
            <div className={`group relative bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 text-center transition-all duration-300 hover:border-${accent}-500/30 hover:bg-white/[0.03] hover:scale-[1.03] hover:shadow-2xl hover:shadow-${accent}-500/5 cursor-pointer`}>
              <div className={`w-14 h-14 rounded-2xl bg-${accent}-500/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-${accent}-500/20 transition-colors`}>
                <Icon className={`w-7 h-7 text-${accent}-400`} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{label}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent projects — minimal */}
      {projects.length > 0 && (
        <div className="w-full max-w-md relative z-10">
          <p className="text-xs text-gray-700 uppercase tracking-wider mb-3 text-center">Recent</p>
          <div className="space-y-1">
            {projects.map(p => (
              <Link key={p.id} href={`/studio?project=${p.id}`}
                className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
                <div>
                  <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{p.title}</span>
                  <span className="text-xs text-gray-700 ml-2">{p.artist}</span>
                </div>
                <ChevronRight className="w-3 h-3 text-gray-800 group-hover:text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
