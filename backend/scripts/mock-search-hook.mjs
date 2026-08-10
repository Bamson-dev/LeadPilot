import { pathToFileURL } from "node:url";

const repoPath = new URL("./mock-search-repository.mjs", import.meta.url).href;
const licensePath = new URL("./mock-license-repository.mjs", import.meta.url).href;
const userSearchPath = new URL("./mock-user-search-repository.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes("database/search-repository")) {
    return { url: repoPath, shortCircuit: true };
  }
  if (specifier.includes("database/license-repository")) {
    return { url: licensePath, shortCircuit: true };
  }
  if (specifier.includes("database/user-search-repository")) {
    return { url: userSearchPath, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
