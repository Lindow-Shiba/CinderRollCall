import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "9th AC Roll Call",
  description: "9th Assault Corps — Roll Call System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header style={{ background: "#0d1117", borderBottom: "1px solid #1e2938" }}>
            <div className="max-w-5xl mx-auto px-6 py-0 flex items-center justify-between" style={{ height: "56px" }}>
              <a href="/" className="flex items-center gap-3">
                <div style={{
                  width: "28px",
                  height: "28px",
                  background: "var(--accent)",
                  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.12em", color: "#e6edf3", lineHeight: 1 }}>
                    9TH ASSAULT CORPS
                  </div>
                  <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "var(--muted)", lineHeight: 1, marginTop: "2px" }}>
                    ROLL CALL SYSTEM
                  </div>
                </div>
              </a>
              <nav className="flex items-center gap-1">
                <a href="/" style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseOver={e => (e.currentTarget.style.color = "#e6edf3")}
                onMouseOut={e => (e.currentTarget.style.color = "var(--muted)")}
                >
                  POST
                </a>
                <a href="/admin" style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseOver={e => (e.currentTarget.style.color = "#e6edf3")}
                onMouseOut={e => (e.currentTarget.style.color = "var(--muted)")}
                >
                  ADMIN
                </a>
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer style={{ borderTop: "1px solid #1e2938", padding: "16px 24px", textAlign: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.08em" }}>
              9TH ASSAULT CORPS · ROLL CALL SYSTEM
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
