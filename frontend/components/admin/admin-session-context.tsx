"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminLogin,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "@/services/admin-api";

interface AdminSessionContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  handleSessionExpired: () => void;
  handleSessionError: (err: unknown) => boolean;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    setToken(null);
  }, []);

  const handleSessionExpired = useCallback(() => {
    logout();
  }, [logout]);

  const handleSessionError = useCallback(
    (err: unknown) => {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        handleSessionExpired();
        return true;
      }
      return false;
    },
    [handleSessionExpired]
  );

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminLogin(email.trim(), password);
    setAdminToken(data.token);
    setToken(data.token);
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
      handleSessionExpired,
      handleSessionError,
    }),
    [token, login, logout, handleSessionExpired, handleSessionError]
  );

  return (
    <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return ctx;
}
