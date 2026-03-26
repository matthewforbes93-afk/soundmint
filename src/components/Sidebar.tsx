'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Sliders, Disc3, Library,
  Upload, ShoppingBag, Settings, Music2, Radio
} from 'lucide-react';

// 6 core navigation items — focused, not overwhelming
const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/session', label: 'Create', icon: Disc3 },
  { href: '/studio', label: 'Studio', icon: Sliders },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/distribute', label: 'Distribute', icon: Upload },
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
];

// Settings at the bottom, separate from main nav
const bottomItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-xl flex items-center justify-center">
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
                  ? 'bg-teal-600/20 text-teal-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="p-4 border-t border-gray-800 space-y-1">
        {bottomItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`}>
              <Icon className="w-4 h-4" /> {label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
