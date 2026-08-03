/**
 * not-found.tsx — branded public 404 (spec §3, §13). Unknown paths are
 * normally server-redirected to the locked landing state by middleware;
 * this page is the safe fallback for anything that slips through an
 * allowlisted prefix. It exposes no private content or route names.
 */
import Link from "next/link";
import "./landing.css";

export const metadata = {
  title: "Page not found - Oriant.ai",
};

export default function NotFound() {
  return (
    <div className="lp">
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <p className="lp-micro" style={{ marginBottom: 16 }}>
            Page not found
          </p>
          <h1
            style={{
              fontFamily: "var(--lp-font-sans)",
              fontSize: "clamp(28px, 4vw, 40px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              margin: "0 0 14px",
            }}
          >
            This page does not exist
          </h1>
          <p
            style={{
              color: "var(--lp-muted-strong)",
              lineHeight: 1.6,
              margin: "0 0 28px",
            }}
          >
            The page you are looking for may have moved. Head back to the
            Oriant.ai home page to keep exploring.
          </p>
          <Link href="/" className="lp-btn lp-btn--primary">
            Back to Oriant.ai
          </Link>
        </div>
      </main>
    </div>
  );
}
