"use client";

interface WebsiteLinkProps {
  website: string;
  className?: string;
  maxLength?: number;
}

export function WebsiteLink({
  website,
  className = "",
  maxLength = 20,
}: WebsiteLinkProps) {
  const href = website.startsWith("http") ? website : `https://${website}`;
  const display = website
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const truncated =
    display.length > maxLength ? `${display.substring(0, maxLength)}...` : display;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "text-xs text-[var(--lt-accent-soft)] no-underline hover:underline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {truncated}
      <span className="ml-0.5 text-[10px]" aria-hidden>
        ↗
      </span>
    </a>
  );
}
