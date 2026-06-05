"use client";

import { useState, useRef } from "react";

interface Contact {
  name: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  website: string;
  category: string;
  country: string;
}

const PRESET_SEARCHES = [
  { label: "Restaurants — Lagos", businessType: "Restaurants", city: "Lagos, Nigeria" },
  { label: "Salons — Accra", businessType: "Salons", city: "Accra, Ghana" },
  { label: "Gyms — Nairobi", businessType: "Gyms", city: "Nairobi, Kenya" },
  { label: "Law Firms — London", businessType: "Law Firms", city: "London, UK" },
  { label: "Hotels — Dubai", businessType: "Hotels", city: "Dubai, UAE" },
  { label: "Dental Clinics — New York", businessType: "Dental Clinics", city: "New York, USA" },
  { label: "Agencies — Cape Town", businessType: "Marketing Agencies", city: "Cape Town, South Africa" },
  { label: "Restaurants — Toronto", businessType: "Restaurants", city: "Toronto, Canada" },
];

function DemoPageContent() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [businessType, setBusinessType] = useState("");
  const [city, setCity] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  function startDemo(bt?: string, c?: string) {
    const bType = bt || businessType;
    const bCity = c || city;

    if (!bType || !bCity || !apiUrl) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setContacts([]);
    setTotalCount(0);
    setSearchDone(false);
    setIsSearching(true);

    const baseCount = 900 + Math.floor(Math.random() * 300);
    const url = `${apiUrl}/demo/search?businessType=${encodeURIComponent(bType)}&city=${encodeURIComponent(bCity)}&count=${baseCount}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        done?: boolean;
        contact?: Contact;
        total?: number;
      };

      if (data.done) {
        setSearchDone(true);
        setIsSearching(false);
        eventSource.close();
        return;
      }

      if (data.contact) {
        setContacts((prev) => [...prev, data.contact!]);
        setTotalCount(data.total ?? 0);

        if (tableRef.current) {
          tableRef.current.scrollTop = tableRef.current.scrollHeight;
        }
      }
    };

    eventSource.onerror = () => {
      setIsSearching(false);
      setSearchDone(true);
      eventSource.close();
    };
  }

  function exportCSV() {
    const headers = ["Business Name", "Phone", "Email", "Website", "Address", "Rating", "Category"];
    const rows = contacts.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.website,
      c.address,
      c.rating,
      c.category,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadthur-${businessType}-${city}.csv`.toLowerCase().replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        background: "#050508",
        minHeight: "100vh",
        color: "#F2F1FF",
        fontFamily: "Inter, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: "#7C3AED",
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "white",
          }}
        >
          LT
        </div>
        <span style={{ fontSize: 20, fontWeight: 800 }}>
          Lead<span style={{ color: "#A78BFA" }}>Thur</span>
        </span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#555570",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Quick searches
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRESET_SEARCHES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setBusinessType(preset.businessType);
                setCity(preset.city);
                startDemo(preset.businessType, preset.city);
              }}
              disabled={isSearching}
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#A78BFA",
                cursor: isSearching ? "not-allowed" : "pointer",
                fontFamily: "Inter, sans-serif",
                opacity: isSearching ? 0.5 : 1,
                transition: "all 0.15s",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "#111118",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: 20,
          marginBottom: 20,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#8888A8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Business Type
          </label>
          <input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="e.g. Restaurants, Salons, Gyms"
            style={{
              width: "100%",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#8888A8",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            City / Country
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Lagos Nigeria, London UK, Dubai UAE"
            style={{
              width: "100%",
              background: "#0A0A10",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              color: "#F2F1FF",
              fontFamily: "Inter, sans-serif",
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => startDemo()}
          disabled={isSearching || !businessType || !city}
          style={{
            background: isSearching || !businessType || !city ? "#1A1A24" : "#7C3AED",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 28px",
            fontSize: 14,
            fontWeight: 700,
            cursor: isSearching || !businessType || !city ? "not-allowed" : "pointer",
            fontFamily: "Inter, sans-serif",
            opacity: isSearching || !businessType || !city ? 0.6 : 1,
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {(isSearching || searchDone) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(isSearching || searchDone) && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10B981",
                  display: "inline-block",
                  animation: isSearching ? "pulse 1.2s infinite" : undefined,
                }}
              />
            )}
            <span style={{ fontSize: 22, fontWeight: 900, color: "#A78BFA" }}>
              {totalCount.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, color: "#8888A8" }}>
              {isSearching ? "businesses found and counting..." : "businesses found"}
            </span>
          </div>

          {searchDone && contacts.length > 0 && (
            <button
              type="button"
              onClick={exportCSV}
              style={{
                background: "#10B981",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Export CSV — {contacts.length.toLocaleString()} contacts
            </button>
          )}
        </div>
      )}

      {contacts.length > 0 && (
        <div
          ref={tableRef}
          style={{
            background: "#0F0F14",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 12,
            overflow: "auto",
            maxHeight: "62vh",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "#111118", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["#", "Business Name", "Phone", "Email", "Website", "Address", "Rating"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: index % 2 === 0 ? "#0F0F14" : "#111118",
                  }}
                >
                  <td style={{ padding: "8px 14px", color: "#555570", fontSize: 11 }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "8px 14px", color: "#F2F1FF", fontWeight: 600 }}>
                    {contact.name}
                  </td>
                  <td
                    style={{
                      padding: "8px 14px",
                      color: "#10B981",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {contact.phone}
                  </td>
                  <td style={{ padding: "8px 14px", color: "#A78BFA" }}>{contact.email}</td>
                  <td style={{ padding: "8px 14px" }}>
                    <a
                      href={`https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#7C3AED",
                        textDecoration: "none",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {contact.website}
                    </a>
                  </td>
                  <td style={{ padding: "8px 14px", color: "#8888A8", maxWidth: 220 }}>
                    {contact.address}
                  </td>
                  <td
                    style={{
                      padding: "8px 14px",
                      color: "#F59E0B",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ★ {contact.rating}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isSearching && contacts.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 24px", color: "#555570" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌍</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#F2F1FF" }}>
            Search any business in any country
          </div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>
            Type a business type and city above, or click a quick search
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {["Lagos Nigeria", "London UK", "Dubai UAE", "Nairobi Kenya", "New York USA", "Accra Ghana"].map(
              (loc) => (
                <span
                  key={loc}
                  style={{
                    background: "rgba(124,58,237,0.08)",
                    border: "1px solid rgba(124,58,237,0.15)",
                    borderRadius: 100,
                    padding: "5px 12px",
                    fontSize: 12,
                    color: "#A78BFA",
                    fontWeight: 600,
                  }}
                >
                  {loc}
                </span>
              )
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
      `}</style>
    </div>
  );
}

export default function DemoPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return (
      <div
        style={{
          background: "#050508",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: "#555570",
          fontSize: 14,
        }}
      >
        Page not found.
      </div>
    );
  }

  return <DemoPageContent />;
}
