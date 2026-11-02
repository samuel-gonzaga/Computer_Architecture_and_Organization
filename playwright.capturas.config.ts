// Gera as capturas do relatório (docs/relatorio/img) a partir do app real.
// Não é um teste: o único fluxo E2E da §8 está em playwright.config.ts.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: "capturas.ts",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3200",
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce", // nenhuma captura sai no meio de uma animação
  },
  webServer: {
    command: "npm run dev -- --port 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
