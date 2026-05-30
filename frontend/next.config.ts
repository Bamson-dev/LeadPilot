import type { NextConfig } from "next";

const PRODUCTION_API_URL = "https://backend.leadthur.com";
const STAGING_API_URL = "https://staging-backend.leadthur.com";

/** Never call the Next.js site as the API — empty or frontend-only URLs cause /checkout/initialize 404. */
function resolvePublicApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
  const gitRef = (process.env.VERCEL_GIT_COMMIT_REF ?? "").trim();
  const vercelHost = (process.env.VERCEL_URL ?? process.env.VERCEL_BRANCH_URL ?? "")
    .toLowerCase()
    .trim();
  const isStagingDeploy =
    gitRef === "staging" ||
    vercelHost.includes("staging.leadthur") ||
    vercelHost.includes("staging-");

  const looksLikeApi =
    configured.length > 0 &&
    (configured.includes("-backend.") || configured.includes("backend."));

  if (looksLikeApi) return configured;
  if (isStagingDeploy) return STAGING_API_URL;
  if (configured.length > 0) return configured;
  return PRODUCTION_API_URL;
}

if (process.env.NODE_ENV === "production") {
  process.env.NEXT_PUBLIC_API_URL = resolvePublicApiUrl();
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: require("path").join(__dirname, ".."),
  transpilePackages: ["@leadthur/shared"],
  // Standalone is for Docker only — breaks default Vercel Next.js deploy
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
