import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SoundMint — Professional Music Studio',
  description: 'Professional music production studio in your browser.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#14b8a6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-[#111] text-white antialiased`}>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '13px' },
          }}
        />
        {children}
      </body>
    </html>
  );
}
