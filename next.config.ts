import type { NextConfig } from "next";

/**
 * Dua mode build:
 * - Default (sandbox/dev): output "standalone".
 * - STATIC_EXPORT=true: static export untuk GitHub Pages (PRD v1.4 bagian 5).
 *   NEXT_PUBLIC_BASE_PATH=/nama-repo untuk project pages (https://user.github.io/nama-repo/).
 *   Routing memakai HashRouter sehingga deep-link aman tanpa rewrite server.
 */
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export" as const,
        ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        output: "standalone",
      }),
  // NEXT_DIST_DIR memungkinkan uji build export terpisah tanpa mengganggu dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
