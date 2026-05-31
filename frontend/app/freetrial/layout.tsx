import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Try LeadThur Free — See Real Business Leads",
  description:
    "Run a real LeadThur search with no signup. Preview 15 businesses with phone numbers before you pay.",
};

export default function FreeTrialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
