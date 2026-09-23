'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Last-resort boundary for failures in the root layout or app shell, where
 * app/error.tsx cannot help. It renders its own document, so styles are inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#04050a', color: '#eee6d8', fontFamily: 'Georgia, serif' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '18vh 20px' }}>
          <p style={{ letterSpacing: '0.38em', fontSize: 13 }}>MERIDIAN</p>
          <h1 style={{ fontWeight: 400, fontSize: 30, lineHeight: 1.2 }}>MERIDIAN stopped working.</h1>
          <p style={{ color: '#b9b3a6', fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.6 }}>
            Something failed while loading the app. Nothing you saved on this device was changed.
          </p>
          <p style={{ display: 'flex', gap: 16, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
            <button type="button" onClick={() => retry()} style={{ padding: '8px 14px', border: '1px solid #c8a866', background: 'transparent', color: '#f0d5a4', cursor: 'pointer' }}>
              Try again
            </button>
            <Link href="/" style={{ color: '#b9b3a6', alignSelf: 'center' }}>Back to World</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
