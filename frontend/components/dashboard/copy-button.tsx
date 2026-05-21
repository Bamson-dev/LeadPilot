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

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => onCopy(value, copyId)}
        className="shrink-0 rounded-md border-0 px-2 py-1 text-[11px] cursor-pointer transition-colors"
        style={{
          background: isCopied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
          color: isCopied ? "#10B981" : "#6B6B80",
        }}
        title="Copy to clipboard"
      >
        {isCopied ? "✓ Copied" : "Copy"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyId)}
      title="Copy to clipboard"
      className={[
        "shrink-0 border-0 bg-transparent cursor-pointer rounded px-1 py-0.5 text-[11px] transition-colors",
        alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
      ].join(" ")}
      style={{ color: isCopied ? "#10B981" : "#6B6B80" }}
    >
      {isCopied ? "✓ Copied" : "⎘"}
    </button>
  );
}
