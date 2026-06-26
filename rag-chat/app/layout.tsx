import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RAG Nutritional Chatbot",
  description: "Build from Scratch · Presented by KOWSHIK",
  keywords: ["nutrition", "RAG", "AI", "chatbot", "health"],
  authors: [{ name: "KOWSHIK" }],
  openGraph: {
    title: "RAG Nutritional Chatbot",
    description: "AI-powered nutrition assistant built from scratch",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#060910",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
      style={{ height: "100%", backgroundColor: "#060910" }}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23060910'/><circle cx='16' cy='16' r='6' fill='%236384ff'/></svg>" />
      </head>
      <body
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          margin: 0,
          padding: 0,
          backgroundColor: "#060910",
          color: "#e8eeff",
          fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          overflowX: "hidden",
        }}
      >
        {/* Ambient top glow */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 240,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(99,132,255,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Subtle dot grid */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(99,132,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Corner bracket — top-left */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed", top: 12, left: 12,
            width: 20, height: 20,
            borderTop: "1.5px solid rgba(99,132,255,0.5)",
            borderLeft: "1.5px solid rgba(99,132,255,0.5)",
            pointerEvents: "none", zIndex: 1,
          }}
        />
        {/* Corner bracket — top-right */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed", top: 12, right: 12,
            width: 20, height: 20,
            borderTop: "1.5px solid rgba(99,132,255,0.5)",
            borderRight: "1.5px solid rgba(99,132,255,0.5)",
            pointerEvents: "none", zIndex: 1,
          }}
        />
        {/* Corner bracket — bottom-left */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed", bottom: 12, left: 12,
            width: 20, height: 20,
            borderBottom: "1.5px solid rgba(99,132,255,0.5)",
            borderLeft: "1.5px solid rgba(99,132,255,0.5)",
            pointerEvents: "none", zIndex: 1,
          }}
        />
        {/* Corner bracket — bottom-right */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed", bottom: 12, right: 12,
            width: 20, height: 20,
            borderBottom: "1.5px solid rgba(99,132,255,0.5)",
            borderRight: "1.5px solid rgba(99,132,255,0.5)",
            pointerEvents: "none", zIndex: 1,
          }}
        />

        {/* Page content */}
        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>

        {/* Ambient bottom glow */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: -80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 400,
            height: 160,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(0,212,170,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      </body>
    </html>
  );
}