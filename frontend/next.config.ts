import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_URL?.trim()) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is required for production builds. Set it in Vercel."
  );
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: require("path").join(__dirname, ".."),
  transpilePackages: ["@leadpilot/shared"],
  // Standalone is for Docker only — breaks default Vercel Next.js deploy
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
