declare global {
  namespace Express {
    interface Request {
      licenseId?: string;
      searchesRemaining?: number;
    }
  }
}

export {};
