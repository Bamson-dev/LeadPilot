"use client";

interface WelcomeStateProps {
  onExampleSearch: (query: string, location: string) => void;
}

const EXAMPLES = [
  { query: "restaurants", location: "Abuja Nigeria" },
  { query: "salons", location: "Nairobi Kenya" },
  { query: "dentists", location: "Manchester UK" },
  { query: "gyms", location: "Dubai UAE" },
  { query: "hotels", location: "Accra Ghana" },
  { query: "real estate agencies", location: "Johannesburg South Africa" },
];

export function WelcomeState({ onExampleSearch }: WelcomeStateProps) {
  return (
    <div
      className="mt-4 text-center"
      style={{
        background: "#0F0F14",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "48px 32px",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
      <h3
        style={{
          color: "#F4F4FF",
          fontSize: 20,
          fontWeight: 700,
          margin: "0 0 8px",
          fontFamily: "Bricolage Grotesque, sans-serif",
        }}
      >
        Find businesses to pitch. Today.
      </h3>
      <p
        style={{
          color: "#6B6B80",
          fontSize: 14,
          margin: "0 0 28px",
          lineHeight: 1.6,
        }}
      >
        Type any business type and any city in the world. Your leads will stream in within
        seconds.
      </p>
      <p
        style={{
          color: "#A1A1AA",
          fontSize: 12,
          margin: "0 0 14px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Try one of these
      </p>
      <div className="flex flex-wrap gap-2.5 justify-center">
        {EXAMPLES.map((example, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onExampleSearch(example.query, example.location)}
            className="transition-all duration-150 cursor-pointer"
            style={{
              background: "transparent",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#A855F7",
              padding: "10px 18px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "Figtree, sans-serif",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(124,58,237,0.1)";
              e.currentTarget.style.borderColor = "#7C3AED";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)";
            }}
          >
            {example.query} in {example.location}
          </button>
        ))}
      </div>
    </div>
  );
}
