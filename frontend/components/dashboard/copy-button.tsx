"use client";

interface CopyButtonProps {
  value: string;
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  /** Always visible on mobile; hover-only on desktop */
  alwaysVisible?: boolean;
  variant?: "inline" | "pill";
}

export function CopyButton({
  value,
  copyId,
  copiedId,
  onCopy,
  alwaysVisible = false,
  variant = "inline",
}: CopyButtonProps) {
  const isCopied = copiedId === copyId;
  const label = isCopied ? "Copied" : "Copy to clipboard";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => onCopy(value, copyId)}
        aria-label={label}
        className={[
          "shrink-0 rounded-md border-0 px-2 py-1 text-[11px] cursor-pointer transition-colors",
          isCopied
            ? "bg-[var(--lt-success-soft)] text-[var(--lt-success)]"
            : "bg-[var(--lt-surface-3)] text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]",
        ].join(" ")}
      >
        {isCopied ? "✓ Copied" : "Copy"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyId)}
      aria-label={label}
      title={label}
      className={[
        "shrink-0 border-0 bg-transparent cursor-pointer rounded px-1 py-0.5 text-[11px] transition-colors",
        alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        isCopied ? "text-[var(--lt-success)]" : "text-[var(--lt-text-muted)] hover:text-[var(--lt-text)]",
      ].join(" ")}
    >
      {isCopied ? "✓ Copied" : "⎘"}
    </button>
  );
}
