import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production to avoid exceeding Cloudflare Pages 25MB file size limit
  productionBrowserSourceMaps: false,
};

export default nextConfig;