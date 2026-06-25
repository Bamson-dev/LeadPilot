"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LeadThurLogo } from "./LeadThurLogo";
import { CHECKOUT, C, FONT, FREETRIAL } from "./theme";

const NAV_LINKS = [
  { label: "How It Works", id: "how-it-works" },
  { label: "Features", id: "features" },
  { label: "Reviews", id: "reviews" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleSectionClick = (id: string) => {
    closeMenu();
    scrollToSection(id);
  };

  return (
    <>
      <nav
        className="homepage-nav"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: "rgba(5, 5, 8, 0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          fontFamily: FONT,
        }}
      >
        <div
          className="homepage-nav-inner"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            height: 64,
            gap: 16,
          }}
        >
          <div style={{ justifySelf: "start" }}>
            <LeadThurLogo />
          </div>

          <div
            className="homepage-nav-links"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 28,
            }}
          >
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                className="homepage-nav-link"
                onClick={() => handleSectionClick(link.id)}
              >
                {link.label}
              </button>
            ))}
          </div>

          <div
            className="homepage-nav-actions"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <Link href={FREETRIAL} className="homepage-nav-try-free">
              Try Free
            </Link>
            <Link href={CHECKOUT} className="homepage-nav-lifetime">
              Get Lifetime Access
            </Link>
            <button
              type="button"
              className="homepage-nav-hamburger"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="homepage-nav-hamburger-line" />
              <span className="homepage-nav-hamburger-line" />
              <span className="homepage-nav-hamburger-line" />
            </button>
          </div>
        </div>

        <div
          className={`homepage-nav-mobile-menu${menuOpen ? " is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="homepage-nav-mobile-link"
              onClick={() => handleSectionClick(link.id)}
            >
              {link.label}
            </button>
          ))}
          <div className="homepage-nav-mobile-buttons">
            <Link
              href={FREETRIAL}
              className="homepage-nav-try-free homepage-nav-try-free--mobile"
              onClick={closeMenu}
            >
              Try Free
            </Link>
            <Link
              href={CHECKOUT}
              className="homepage-nav-lifetime homepage-nav-lifetime--mobile"
              onClick={closeMenu}
            >
              Get Lifetime Access
            </Link>
          </div>
        </div>
      </nav>

      <style>{`
        html {
          scroll-behavior: smooth;
        }

        #how-it-works,
        #features,
        #reviews,
        #pricing,
        #faq {
          scroll-margin-top: 64px;
        }

        .homepage-nav-link {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          color: #7878A0;
          cursor: pointer;
          transition: color 0.2s ease;
          white-space: nowrap;
        }

        .homepage-nav-link:hover {
          color: #F0EEFF;
        }

        .homepage-nav-try-free {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(167, 139, 250, 0.3);
          color: #A78BFA;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
          transition: background-color 0.2s ease;
        }

        .homepage-nav-try-free:hover {
          background: rgba(124, 58, 237, 0.08);
        }

        .homepage-nav-lifetime {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          border-radius: 8px;
          background: #7C3AED;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          transition: box-shadow 0.2s ease;
        }

        .homepage-nav-lifetime:hover {
          animation: marketing-glow-pulse 2.5s ease-in-out infinite;
        }

        .homepage-nav-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          width: 40px;
          height: 40px;
          padding: 8px;
          border: none;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
        }

        .homepage-nav-hamburger-line {
          display: block;
          width: 100%;
          height: 2px;
          background: ${C.text};
          border-radius: 1px;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .homepage-nav-mobile-menu {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
          background: rgba(5, 5, 8, 0.98);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }

        .homepage-nav-mobile-menu.is-open {
          max-height: 520px;
        }

        .homepage-nav-mobile-link {
          display: block;
          width: 100%;
          padding: 16px 24px;
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: none;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          color: #7878A0;
          text-align: left;
          cursor: pointer;
          transition: color 0.2s ease, background-color 0.2s ease;
        }

        .homepage-nav-mobile-link:hover {
          color: #F0EEFF;
          background: rgba(255, 255, 255, 0.03);
        }

        .homepage-nav-mobile-buttons {
          display: none;
          flex-direction: column;
          gap: 10px;
          padding: 16px 24px 20px;
        }

        .homepage-nav-try-free--mobile,
        .homepage-nav-lifetime--mobile {
          width: 100%;
          text-align: center;
        }

        @media (max-width: 767px) {
          .homepage-nav-inner {
            height: 56px !important;
            grid-template-columns: 1fr auto !important;
          }

          .homepage-nav-links {
            display: none !important;
          }

          .homepage-nav-actions .homepage-nav-try-free,
          .homepage-nav-actions .homepage-nav-lifetime {
            display: none !important;
          }

          .homepage-nav-hamburger {
            display: flex !important;
          }

          .homepage-nav-mobile-buttons {
            display: flex !important;
          }

          #how-it-works,
          #features,
          #reviews,
          #pricing,
          #faq {
            scroll-margin-top: 56px;
          }
        }

        @media (min-width: 768px) {
          .homepage-nav-mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
