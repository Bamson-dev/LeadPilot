export function getGitCommitSha(): string {
  return (
    process.env.GIT_COMMIT_SHA?.trim() ||
    process.env.COOLIFY_BRANCH_COMMIT_SHA?.trim() ||
    process.env.SOURCE_COMMIT?.trim() ||
    "unknown"
  );
}
