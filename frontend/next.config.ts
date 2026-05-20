import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@leadpilot/shared"],
  // Standalone is for Docker only — breaks default Vercel Next.js deploy
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
