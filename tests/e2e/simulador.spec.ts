// Fluxo E2E da §8: abrir o app → carregar o exemplo 1 → digitar a entrada 5 → executar → o display mostra 12.

import { expect, test } from "@playwright/test";

test("soma simples: entrada 5 no teclado, display mostra 12", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NeoCore Computer Lab" })).toBeVisible();

  // Carrega o exemplo 1 pelo editor.
  await page.getByRole("button", { name: "Editor ▶" }).click();
  await page.getByLabel("Exemplos").selectOption("soma-simples");
  await page.getByRole("button", { name: "Montar e carregar" }).click();
  await expect(page.getByText('"Soma simples" carregado no disco')).toBeVisible();

  // Digita a entrada do teclado (0xF0).
  const keyboard = page.getByLabel("Teclado 0xF0");
  await keyboard.fill("5");
  await keyboard.press("Enter");

  // Executa na velocidade máxima até o HLT.
  await page.getByLabel("Velocidade").selectOption("4");
  await page.getByRole("button", { name: "Executar (Espaço)" }).click();
  await expect(page.getByRole("heading", { name: "HLT: fim da execução" })).toBeVisible({ timeout: 30_000 });

  // O display (0xF1) mostra 12.
  await expect(page.locator('[data-component="DISPLAY"] .dg-screen-digits')).toHaveText(/^\s*12$/);
  await expect(page.getByText("Parada", { exact: true })).toBeVisible();
});
