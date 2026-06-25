import { C, FONT } from "./theme";

const COUNTRIES = [
  "🇳🇬 Nigeria",
  "🇬🇧 United Kingdom",
  "🇺🇸 United States",
  "🇦🇪 UAE",
  "🇰🇪 Kenya",
  "🇬🇭 Ghana",
  "🇿🇦 South Africa",
  "🇨🇦 Canada",
  "🇦🇺 Australia",
  "🇮🇳 India",
];

export function LogoBar() {
  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "40px 0",
        fontFamily: FONT,
        overflow: "hidden",
      }}
    >
      <p
        style={{
          textAlign: "center",
          fontSize: 13,
          color: C.muted,
          margin: "0 0 20px",
          padding: "0 24px",
        }}
      >
        Businesses found in cities across these countries and more
      </p>
      <div
        style={{
          display: "flex",
          gap: 24,
          overflowX: "auto",
          padding: "0 24px 8px",
          justifyContent: "center",
          flexWrap: "wrap",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {COUNTRIES.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 14,
              color: C.muted,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {c}
          </span>
        ))}
      </div>
    </section>
  );
}
