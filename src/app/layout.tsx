import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Player from '@/components/Player';
import { Toaster } from 'react-hot-toast';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SoundMint - Mint Your Music Empire',
  description: 'Generate, publish, and monetize AI music across all streaming platforms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 text-white antialiased`}>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' },
          }}
        />
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-24">
            {children}
          </main>
        </div>
        <Player />
      </body>
    </html>
  );
}
