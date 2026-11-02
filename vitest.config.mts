import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // O fluxo E2E (tests/e2e) roda no Playwright, não aqui.
    projects: [
      {
        extends: true,
        test: { name: "core", include: ["tests/core/**/*.test.ts"] },
      },
      {
        // Parte pura e renderizável da interface (o SVG é gerado com react-dom/server).
        // O React em modo produção renderiza ~20× mais rápido; os testes verificam a
        // estrutura do SVG, que não depende dos avisos do modo de desenvolvimento.
        extends: true,
        oxc: { jsx: { runtime: "automatic", development: false } },
        test: {
          name: "components",
          include: ["tests/components/**/*.test.{ts,tsx}", "tests/store/**/*.test.ts", "tests/docs/**/*.test.ts"],
          env: { NODE_ENV: "production" },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      // types.ts só contém tipos (sem código executável).
      exclude: ["src/core/types.ts"],
      // Cobertura mínima do núcleo — CLAUDE.md §8.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
