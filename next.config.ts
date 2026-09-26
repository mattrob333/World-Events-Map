import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  experimental: {
    optimizePackageImports: ['@react-three/drei', 'motion'],
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  poweredByHeader: false,
  // The Vibe profile used to be called the mood board; old links land on it. The Spotify
  // callback (/moodboard/spotify) and import links (/moodboard/import) keep their paths.
  async redirects() {
    // Shelved by the North Star spec: hidden, code kept, back on with the flag (see src/lib/flags.ts).
    const access = process.env.NEXT_PUBLIC_FEATURE_ACCESS === '1';
    const circles = process.env.NEXT_PUBLIC_FEATURE_CIRCLES === '1';
    return [
      { source: '/moodboard', destination: '/vibe', permanent: false },
      // Constellation and the example portraits are gone; your travelers live on the You tab.
      { source: '/constellation', destination: '/vibe', permanent: false },
      { source: '/people', destination: '/vibe', permanent: false },
      { source: '/people/:handle((?!card$)[^/]+)', destination: '/vibe', permanent: false },
      // One Now: the Vibe Now map.
      { source: '/nearby', destination: '/now', permanent: false },
      ...(access ? [] : [
        { source: '/access', destination: '/', permanent: false },
        { source: '/access/:path*', destination: '/', permanent: false },
        { source: '/partners', destination: '/', permanent: false },
        { source: '/partners/:path*', destination: '/', permanent: false },
      ]),
      // The directory goes; circle rooms (/circles/<id>) stay, since shared trips use them.
      ...(circles ? [] : [
        { source: '/circles', destination: '/trips', permanent: false },
        { source: '/community', destination: '/trips', permanent: false },
      ]),
    ];
  },
  // Baseline hardening only. A strict script/img CSP would break the remote
  // images (Wikimedia, Google, Instagram, TikTok, Yelp, Tripadvisor CDNs),
  // Spotify and map embeds; framing, sniffing and referrer leaks are covered.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Voice needs the mic and Vibe Now needs location, from our own pages only.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
