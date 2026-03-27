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
};

export default nextConfig;