'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wand2, Library, Layers, Sliders, Settings, Music2 } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/generate', label: 'Generate', icon: Wand2 },
  { href: '/studio', label: 'Studio', icon: Sliders },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/bulk', label: 'Bulk Generate', icon: Layers },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">SoundMint</h1>
            <p className="text-xs text-gray-500">Mint Your Music</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
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
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Quick Tip</p>
          <p className="text-xs text-gray-500">Use Bulk Generate to create 10-50 tracks at once for maximum output.</p>
        </div>
      </div>
    </aside>
  );
}
