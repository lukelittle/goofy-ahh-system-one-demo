import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone: a self-contained server.js with only the runtime
  // files it needs, so the container image skips node_modules entirely.
  output: "standalone",
};

export default nextConfig;
