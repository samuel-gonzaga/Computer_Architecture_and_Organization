import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build estático (pasta out/) para deploy na Vercel — CLAUDE.md §3.
  // cacheComponents/partialPrefetching (padrão do create-next-app) foram removidos:
  // o PPR não é compatível com output "export".
  output: "export",
  // Sem o indicador flutuante do modo dev: ele apareceria nas capturas do relatório e no vídeo.
  devIndicators: false,
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
