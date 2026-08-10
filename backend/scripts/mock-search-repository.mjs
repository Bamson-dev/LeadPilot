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

export async function createSearchJob() {
  throw new Error("not implemented in mock");
}

export async function getSearchJob(id) {
  return jobs.get(id)?.job ?? null;
}

export async function getSearchJobAccess(id) {
  return jobs.get(id) ?? null;
}

export async function getSearchResults() {
  return { leads: [{ id: "lead-1", name: "Test Cafe" }], total: 1 };
}

export async function markSearchComplete() {}
export async function markSearchFailed() {}
