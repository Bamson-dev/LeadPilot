declare global {
  namespace Express {
    interface Request {
      licenseId?: string;
      licenseKey?: string;
      searchesRemaining?: number;
    }
  }
}

export {};
