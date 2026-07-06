declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
      licenseId?: string;
      licenseKey?: string;
      licenseEmail?: string;
      searchesRemaining?: number;
      creditsRemaining?: number;
      searchAccess?: import("../database/search-repository").SearchJobAccess;
    }
  }
}

export {};
