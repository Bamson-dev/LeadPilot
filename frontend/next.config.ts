import type { NextConfig } from "next";

const PRODUCTION_API_URL = "https://backend.leadthur.com";
const STAGING_API_URL = "https://staging-backend.leadthur.com";
const API_PROXY_PATH = "/backend";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Absolute backend origin used for Next.js rewrites and server-side fetches. */
function resolveBackendOrigin(): string {
  const fromEnv = process.env.BACKEND_ORIGIN?.trim();
  if (fromEnv?.startsWith("http")) return stripTrailingSlash(fromEnv);

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (configured.startsWith("http") && (configured.includes("backend.") || configured.includes("-backend."))) {
    return stripTrailingSlash(configured);
  }

  const gitRef = (process.env.VERCEL_GIT_COMMIT_REF ?? "").trim();
  const vercelHost = (process.env.VERCEL_URL ?? process.env.VERCEL_BRANCH_URL ?? "")
    .toLowerCase()
    .trim();
  const isStagingDeploy =
    gitRef === "staging" ||
    vercelHost.includes("staging.leadthur") ||
    vercelHost.includes("staging-");

  return isStagingDeploy ? STAGING_API_URL : PRODUCTION_API_URL;
}

/**
 * Browser-facing API base.
 * In Docker/Coolify we use a same-origin `/backend` proxy so login/search
 * are not blocked by cross-origin "fetch failed" on some networks.
 */
function resolvePublicApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

  // Docker production: always same-origin proxy. Absolute NEXT_PUBLIC_API_URL
  // (if set in Coolify) is used only as BACKEND_ORIGIN for the rewrite target.
  if (process.env.DOCKER_BUILD === "1") {
    return API_PROXY_PATH;
  }

  if (configured === API_PROXY_PATH || configured === `${API_PROXY_PATH}/`) {
    return API_PROXY_PATH;
  }

  // Explicit relative proxy
  if (configured.startsWith("/") && !configured.startsWith("//")) {
    return stripTrailingSlash(configured) || API_PROXY_PATH;
  }

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

  if (looksLikeApi) return stripTrailingSlash(configured);
  if (isStagingDeploy) return STAGING_API_URL;
  if (configured.length > 0) return stripTrailingSlash(configured);

  return PRODUCTION_API_URL;
}

const backendOrigin = resolveBackendOrigin();
const publicApiUrl = resolvePublicApiUrl();

if (process.env.NODE_ENV === "production") {
  process.env.NEXT_PUBLIC_API_URL = publicApiUrl;
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: require("path").join(__dirname, ".."),
  transpilePackages: ["@leadthur/shared"],
  // Standalone is for Docker only — breaks default Vercel Next.js deploy
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  async rewrites() {
    // Only proxy when the client is configured to hit the relative path
    if (publicApiUrl !== API_PROXY_PATH && !publicApiUrl.startsWith(`${API_PROXY_PATH}/`)) {
      return [];
    }
    return [
      {
        source: `${API_PROXY_PATH}/:path*`,
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
