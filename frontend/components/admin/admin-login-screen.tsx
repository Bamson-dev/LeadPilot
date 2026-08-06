"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque } from "next/font/google";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { useAdminSession } from "@/components/admin/admin-session-context";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export function AdminLoginScreen() {
  const router = useRouter();
  const { login } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      setPassword("");
      router.replace("/admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLoginForm
      email={email}
      password={password}
      error={error}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      titleClassName={`${bricolage.className} text-2xl font-bold text-[var(--lt-text)]`}
    />
  );
}
