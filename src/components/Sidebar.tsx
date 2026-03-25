'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Sliders, Wand2, Library,
  Upload, FolderOpen, Settings, Music2, Mic, Radio
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/studio', label: 'Studio', icon: Sliders },
  { href: '/playground', label: 'AI Playground', icon: Wand2 },
  { href: '/recorder', label: 'Recorder', icon: Mic },
  { href: '/library', label: 'Sound Library', icon: Library },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/distribute', label: 'Distribute', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SoundMint</h1>
            <p className="text-xs text-gray-500">Production Studio</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-purple-600/20 text-purple-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-4 border border-purple-800/30">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-purple-300 font-medium">Local Server</p>
          </div>
          <p className="text-xs text-gray-500">MusicGen + Demucs on GPU</p>
        </div>
      </div>
    </aside>
  );
}
