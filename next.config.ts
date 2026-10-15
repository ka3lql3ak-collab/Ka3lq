import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
  // Media is served from ./data through /api/media with its own validation.
  experimental: { serverActions: { bodySizeLimit: "200mb" } },
};

export default nextConfig;
