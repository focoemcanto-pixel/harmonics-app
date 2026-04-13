import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,

  // CRITICAL: OpenNext requires standalone mode
  output: "standalone",

  // Turbopack configuration (Next.js 16 default)
  turbopack: {},

  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
};

export default nextConfig;
