import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ALL source maps in production for Cloudflare Pages 25MB limit
  productionBrowserSourceMaps: false,

  // Disable server source maps and reduce worker pool to prevent memory issues
  experimental: {
    serverSourceMaps: false,
    workerThreads: false,
    cpus: 1,
  },

  // Optimize output
  output: 'standalone',

  // Additional webpack config to ensure no source maps and optimize memory
  webpack: (config, { isServer }) => {
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

  // Note: 'eslint' config removed - no longer supported in Next.js 16
  // Use .eslintrc or eslint.config.mjs instead

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;