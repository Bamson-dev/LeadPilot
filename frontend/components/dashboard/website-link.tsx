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
      className={className}
      style={{
        color: "#A855F7",
        textDecoration: "none",
        fontSize: 12,
      }}
    >
      {truncated}
      <span style={{ marginLeft: 3, fontSize: 10 }}>↗</span>
    </a>
  );
}
