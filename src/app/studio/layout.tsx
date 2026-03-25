'use client';

import Link from 'next/link';
import { Music2, ArrowLeft } from 'lucide-react';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col overflow-hidden">
      {/* Minimal top bar */}
      <div className="h-10 bg-[#111118] border-b border-white/5 flex items-center px-3 gap-3 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-pink-500 rounded-md flex items-center justify-center">
              <Music2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-semibold text-white/70">SoundMint Studio</span>
          </div>
        </Link>
      </div>
      {children}
    </div>
  );
}
