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

  // Additional webpack config to ensure no source maps and optimize memory
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.devtool = false;
    }

    // Reduce memory pressure
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };

    return config;
  },

  // Reduce build parallelism to prevent worker exhaustion
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;