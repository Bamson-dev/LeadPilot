"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivationTrackerSection,
  type ActivationData,
} from "@/components/admin/activation-tracker-section";
import { AccountLookup } from "@/components/admin/account-lookup";
import { DirectMessaging } from "@/components/admin/direct-messaging";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { getAdminFetchHeaders } from "@/components/admin/admin-utils";
import {
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { generateAccess } from "@/services/admin-api";
import { useSearchParams } from "next/navigation";

export function AccountsWorkspace() {
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email");
  const { handleSessionExpired, handleSessionError } = useAdminSession();

  const [activations, setActivations] = useState<ActivationData | null>(null);
  const [activationsLoading, setActivationsLoading] = useState(false);
  const [activePreset, setActivePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const [generateEmail, setGenerateEmail] = useState("");
  const [generateMsg, setGenerateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [generateLoading, setGenerateLoading] = useState(false);
  const [prefillConsumed, setPrefillConsumed] = useState(false);

  const loadActivations = useCallback(
    async (preset?: string, from?: string, to?: string) => {
      setActivationsLoading(true);
      try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/admin/activations`;

        if (from && to) {
          url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        } else {
          url += `?preset=${preset || "today"}`;
        }

        const res = await fetch(url, { headers: getAdminFetchHeaders() });
        if (res.ok) {
          setActivations((await res.json()) as ActivationData);
        }
      } catch {
        /* silent */
      } finally {
        setActivationsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadActivations("today");
  }, [loadActivations]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerateMsg(null);
    setGenerateLoading(true);
    try {
      const result = (await generateAccess(generateEmail.trim())) as {
        message?: string;
        key?: string;
      };
      setGenerateMsg({
        type: "ok",
        text: result.message ?? `Access sent. Key: ${result.key ?? "created"}`,
      });
      setGenerateEmail("");
    } catch (err) {
      if (!handleSessionError(err)) {
        setGenerateMsg({
          type: "err",
          text: err instanceof Error ? err.message : "Failed to generate access",
        });
      }
    } finally {
      setGenerateLoading(false);
    }
  }

  return (
    <>
      <AdminWorkspaceHeader
        title="Accounts"
        description="Look up customers, track activations, generate access, and send direct messages."
      />

      <ActivationTrackerSection
        activations={activations}
        activationsLoading={activationsLoading}
        activePreset={activePreset}
        showCustom={showCustom}
        customFrom={customFrom}
        customTo={customTo}
        setActivePreset={setActivePreset}
        setShowCustom={setShowCustom}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
        loadActivations={loadActivations}
      />

      <Panel className="mb-6">
        <PanelHeader>
          <PanelTitle>Generate Access</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <form onSubmit={handleGenerate} className="space-y-3">
            <label className={adminLabelClass}>Buyer Email Address</label>
            <Input
              type="email"
              value={generateEmail}
              onChange={(e) => setGenerateEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full sm:w-auto" disabled={generateLoading}>
              Generate and Send Access
            </Button>
          </form>
          {generateMsg ? (
            <p
              className={`mt-3 text-sm ${generateMsg.type === "ok" ? "text-[var(--lt-success)]" : "text-[var(--lt-danger)]"}`}
            >
              {generateMsg.text}
            </p>
          ) : null}
        </PanelContent>
      </Panel>

      <AccountLookup
        onSessionExpired={handleSessionExpired}
        prefillEmail={prefillConsumed ? null : prefillEmail}
        onPrefillConsumed={() => setPrefillConsumed(true)}
      />

      <DirectMessaging onSessionExpired={handleSessionExpired} />
    </>
  );
}
