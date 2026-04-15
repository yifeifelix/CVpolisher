import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Use webpack instead of Turbopack for production builds
  // to ensure native module (better-sqlite3) resolves correctly
};

export default nextConfig;
