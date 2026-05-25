declare global {
  namespace Express {
    interface Request {
      licenseId?: string;
      licenseKey?: string;
      licenseEmail?: string;
      searchesRemaining?: number;
    }
  }
}

export {};
