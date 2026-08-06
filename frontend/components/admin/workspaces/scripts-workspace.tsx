"use client";

import { useCallback, useEffect, useState } from "react";
import { GlobalScriptsSection } from "@/components/admin/global-scripts-section";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { getAdminFetchHeaders, getAdminJsonHeaders } from "@/components/admin/admin-utils";

export function ScriptsWorkspace() {
  const [headScripts, setHeadScripts] = useState("");
  const [bodyScripts, setBodyScripts] = useState("");
  const [scriptsSaving, setScriptsSaving] = useState(false);
  const [scriptsMsg, setScriptsMsg] = useState("");

  const loadSiteSettings = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/site-settings`, {
        headers: getAdminFetchHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { headScripts?: string; bodyScripts?: string };
        setHeadScripts(data.headScripts || "");
        setBodyScripts(data.bodyScripts || "");
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadSiteSettings();
  }, [loadSiteSettings]);

  async function saveScripts() {
    setScriptsSaving(true);
    setScriptsMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/site-settings`, {
        method: "POST",
        headers: getAdminJsonHeaders(),
        body: JSON.stringify({ headScripts, bodyScripts }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setScriptsMsg("Scripts saved. Changes apply to every page within 60 seconds.");
      } else {
        setScriptsMsg(data.error || "Failed to save scripts.");
      }
    } catch {
      setScriptsMsg("Failed to save scripts.");
    } finally {
      setScriptsSaving(false);
    }
  }

  return (
    <>
      <AdminWorkspaceHeader
        title="Global Scripts"
        description="Inject tracking codes and scripts into every page sitewide."
      />
      <GlobalScriptsSection
        headScripts={headScripts}
        bodyScripts={bodyScripts}
        scriptsSaving={scriptsSaving}
        scriptsMsg={scriptsMsg}
        setHeadScripts={setHeadScripts}
        setBodyScripts={setBodyScripts}
        saveScripts={saveScripts}
      />
    </>
  );
}
