"use client";

import {
  AdminSection,
  AdminSectionHeader,
  adminLabelClass,
  adminMutedClass,
  adminSectionBodyClass,
} from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

const textareaClass =
  "w-full resize-y rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3.5 py-3 font-mono text-xs leading-relaxed text-[var(--lt-text)] outline-none transition-colors focus-visible:border-[var(--lt-cyan)]/40 focus-visible:ring-2 focus-visible:ring-[var(--lt-cyan)]/50";

export function GlobalScriptsSection({
  headScripts,
  bodyScripts,
  scriptsSaving,
  scriptsMsg,
  setHeadScripts,
  setBodyScripts,
  saveScripts,
}: {
  headScripts: string;
  bodyScripts: string;
  scriptsSaving: boolean;
  scriptsMsg: string;
  setHeadScripts: (value: string) => void;
  setBodyScripts: (value: string) => void;
  saveScripts: () => void | Promise<void>;
}) {
  const isSuccess = scriptsMsg.includes("saved");

  return (
    <AdminSection id="admin-scripts" className="mb-6">
      <AdminSectionHeader
        title="Global Scripts"
        description="Inject tracking codes and scripts into every page sitewide"
      />

      <div className={adminSectionBodyClass}>
        <Alert variant="warning" className="mb-5 text-xs leading-relaxed">
          Scripts added here inject into every page on leadthur.com. A broken script can affect the
          entire site. Test on staging before saving to production. Keep a backup before making
          changes.
        </Alert>

        <div className="mb-4">
          <label className={cn(adminLabelClass, "mb-1.5 block uppercase tracking-wider")}>
            Head Scripts
          </label>
          <p className={cn(adminMutedClass, "mb-2 text-xs leading-relaxed")}>
            Paste Google Analytics, Meta Pixel, or any script that belongs inside the head tag.
          </p>
          <textarea
            value={headScripts}
            onChange={(e) => setHeadScripts(e.target.value)}
            placeholder={`Paste the full tracking code exactly as provided.\n\nInclude the outer <script> tags.\n\nExample Meta Pixel:\n<script>\n  fbq('init', 'YOUR_PIXEL_ID');\n  fbq('track', 'PageView');\n</script>\n<noscript>...</noscript>`}
            rows={8}
            className={textareaClass}
          />
        </div>

        <div className="mb-4">
          <label className={cn(adminLabelClass, "mb-1.5 block uppercase tracking-wider")}>
            Body Scripts
          </label>
          <p className={cn(adminMutedClass, "mb-2 text-xs leading-relaxed")}>
            Paste scripts that belong before the closing body tag. Use for chat widgets or heatmaps.
          </p>
          <textarea
            value={bodyScripts}
            onChange={(e) => setBodyScripts(e.target.value)}
            placeholder={`<!-- Example: Meta Pixel -->\n<script>\n  fbq('init', 'YOUR_PIXEL_ID');\n  fbq('track', 'PageView');\n</script>`}
            rows={8}
            className={textareaClass}
          />
        </div>

        <Button type="button" onClick={() => void saveScripts()} disabled={scriptsSaving}>
          {scriptsSaving ? "Saving..." : "Save Scripts"}
        </Button>

        {scriptsMsg && (
          <Alert variant={isSuccess ? "success" : "danger"} className="mt-3 text-xs font-semibold">
            {scriptsMsg}
          </Alert>
        )}
      </div>
    </AdminSection>
  );
}
