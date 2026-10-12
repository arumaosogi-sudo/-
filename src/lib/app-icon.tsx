import { ImageResponse } from "next/og";

const BRAND = "#2f9e7a";

/**
 * App icon: white piggy bank (lucide "piggy-bank") on the brand green.
 * `maskable` fills the whole square and keeps the glyph inside the safe zone,
 * for Android adaptive icons and iOS (which apply their own rounded mask).
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND,
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
          <path d="M16 10h.01" />
          <path d="M2 8v1a2 2 0 0 0 2 2h1" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
