import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres build that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Dev only: let a phone on the same Wi-Fi reach the dev server.
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
