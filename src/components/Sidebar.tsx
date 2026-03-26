'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Disc3, Sliders, Library, Upload, ShoppingBag, Settings, Music2
} from 'lucide-react';

const nav = [
  { href: '/', icon: Music2, label: 'Home' },
  { href: '/session', icon: Disc3, label: 'Create' },
  { href: '/studio', icon: Sliders, label: 'Studio' },
  { href: '/library', icon: Library, label: 'Library' },
  { href: '/distribute', icon: Upload, label: 'Distribute' },
  { href: '/marketplace', icon: ShoppingBag, label: 'Market' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 hover:w-48 transition-all duration-200 bg-black border-r border-white/[0.03] min-h-screen flex flex-col items-center group overflow-hidden flex-shrink-0">
      {/* Logo */}
      <div className="w-full py-5 flex justify-center border-b border-white/[0.03]">
        <Link href="/">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-emerald-400 rounded-xl flex items-center justify-center">
            <Music2 className="w-4 h-4 text-white" />
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 w-full py-4 space-y-1 px-2">
        {nav.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-teal-500/10 text-teal-400'
                  : 'text-gray-700 hover:text-white hover:bg-white/[0.03]'
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="w-full py-4 border-t border-white/[0.03] px-2">
        <Link href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            pathname === '/settings' ? 'text-teal-400' : 'text-gray-800 hover:text-gray-400'
          }`}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
