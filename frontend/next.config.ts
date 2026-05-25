import type { NextConfig } from "next";

const DEFAULT_PRODUCTION_API_URL = "https://backend.leadpilot.live";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_API_URL?.trim()
) {
  process.env.NEXT_PUBLIC_API_URL = DEFAULT_PRODUCTION_API_URL;
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: require("path").join(__dirname, ".."),
  transpilePackages: ["@leadpilot/shared"],
  // Standalone is for Docker only — breaks default Vercel Next.js deploy
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
