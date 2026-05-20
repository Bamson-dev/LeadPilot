import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@leadpilot/shared"],
  output: "standalone",
};

export default nextConfig;
