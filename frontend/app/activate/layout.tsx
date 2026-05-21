import { Suspense } from "react";

export default function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="min-h-screen bg-[#09090B]" />}>{children}</Suspense>;
}
