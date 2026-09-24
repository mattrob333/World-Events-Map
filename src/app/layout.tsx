import type { Metadata, Viewport } from 'next';
import { preconnect } from 'react-dom';
import { AppShell } from '@/components/shell';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'dope.travel — Trips worth talking about',
  description:
    'Trips worth talking about. Where the world is worth being, the music you love when you get there, and a group plan everyone actually wants.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#050505',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Lets env(safe-area-inset-*) work on notched phones and the installed app.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Commons photos (cards, destination heroes) come from Wikimedia's thumbnail
  // host; opening the connection early saves a DNS + TLS round trip on phones.
  preconnect('https://thumb.wikimedia.org');
  return (
    <html lang="en" className="dark">
        <body className="min-h-full antialiased">
          <AppShell>{children}</AppShell>
        </body>
    </html>
  );
}
