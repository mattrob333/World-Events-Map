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
    return [{ source: '/moodboard', destination: '/vibe', permanent: false }];
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
        ],
      },
    ];
  },
};

export default nextConfig;
