import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build estático (pasta out/) para deploy na Vercel — CLAUDE.md §3.
  // cacheComponents/partialPrefetching (padrão do create-next-app) foram removidos:
  // o PPR não é compatível com output "export".
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
