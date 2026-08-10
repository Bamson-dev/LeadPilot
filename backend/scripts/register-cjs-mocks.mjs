import { createRequire } from "node:module";

const jobs = new Map();

export function seedSearchJob(id, { licenseEmail = null, isTrial = false } = {}) {
  jobs.set(id, {
    job: {
      id,
      query: "cafe",
      location: "lagos",
      status: "completed",
      totalFound: 1,
      processed: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      isTrial,
    },
    licenseEmail,
    isTrial,
  });
}

export async function registerCjsMocks() {
  const Module = await import("node:module");
  const originalLoad = Module.default._load;

  Module.default._load = function (request, parent, isMain) {
    if (request.includes("database/search-repository")) {
      return {
        createSearchJob: async () => {
          throw new Error("not implemented in mock");
        },
        getSearchJob: async (id) => jobs.get(id)?.job ?? null,
        getSearchJobAccess: async (id) => jobs.get(id) ?? null,
        getSearchResults: async () => ({
          leads: [{ id: "lead-1", name: "Test Cafe" }],
          total: 1,
        }),
        markSearchComplete: async () => {},
        markSearchFailed: async () => {},
      };
    }

    if (request.includes("database/license-repository")) {
      return {
        getLicenseByKeyAndEmail: async (key, email) => {
          const licenses = globalThis.__mockLicenses;
          const record = licenses?.get(
            `${String(email).toLowerCase().trim()}|${String(key).trim().toUpperCase()}`
          );
          if (!record) return null;
          return {
            id: record.id,
            email: record.email,
            key: record.key,
            activated: record.activated,
            is_suspended: record.is_suspended,
          };
        },
      };
    }

    if (request.includes("database/user-search-repository")) {
      return {
        getUserSearchHistory: async () => [],
        saveUserSearch: async () => {},
      };
    }

    return originalLoad(request, parent, isMain);
  };
}
