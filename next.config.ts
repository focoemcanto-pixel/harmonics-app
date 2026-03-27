import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,

  // CRITICAL: OpenNext requires standalone mode
  output: "standalone",

  // Disable source maps for server bundles
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.devtool = false;
    }
    return config;
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;