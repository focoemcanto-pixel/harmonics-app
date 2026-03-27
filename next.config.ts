import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ALL source maps in production for Cloudflare Workers 25MB limit
  productionBrowserSourceMaps: false,

  // CRITICAL: OpenNext requires standalone mode
  output: "standalone",

  // Disable server source maps and reduce worker pool to prevent memory issues
  experimental: {
    serverSourceMaps: false,
    workerThreads: false,
  },

  // Additional webpack config to ensure no source maps and optimize memory
  webpack: (config, { isServer }) => {
    // CRITICAL: Disable cache to prevent large .pack files
    config.cache = false;

    if (isServer) {
      config.devtool = false;
    }

    // Reduce memory pressure
    config.optimization = {
      ...config.optimization,
      minimize: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
        },
      },
    };

    return config;
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;