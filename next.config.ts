import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ALL source maps in production for Cloudflare Pages 25MB limit
  productionBrowserSourceMaps: false,
  
  // Disable server source maps
  experimental: {
    serverSourceMaps: false,
  },
  
  // Additional webpack config to ensure no source maps
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;