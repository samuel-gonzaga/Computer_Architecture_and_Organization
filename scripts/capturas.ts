// Capturas do relatório técnico, feitas no app real (npm run capturas).
// Cada figura corresponde a uma microetapa exata do exemplo 1 ou ao fim do exemplo 2.

import { test, type Page } from "@playwright/test";

const OUT = "docs/relatorio/img";

/** Avança n microetapas pelo atalho → (o motor é determinístico: sempre a mesma microetapa). */
async function stepTo(page: Page, microSteps: number) {
  await page.getByRole("button", { name: "Reset" }).click();
  await page.locator("body").click({ position: { x: 2, y: 2 } }); // tira o foco dos botões
  for (let i = 0; i < microSteps; i++) await page.keyboard.press("ArrowRight");
}

const diagram = (page: Page) => page.locator("main svg.dg-root").first();

test("capturas do relatório", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  // Seção 2: BOOT — o loader copia o programa do disco para a RAM (microetapa 1).
  await stepTo(page, 1);
  await diagram(page).screenshot({ path: `${OUT}/boot.png` });

  // Seções 5 e 6: 1ª busca, consulta à cache com MISS e espera da RAM (microetapa 3).
  await stepTo(page, 3);
  await diagram(page).screenshot({ path: `${OUT}/busca-miss.png` });

  // Seção 6.1: o teclado responde no barramento de dados (microetapa 9).
  await stepTo(page, 9);
  await diagram(page).screenshot({ path: `${OUT}/es-teclado.png` });

  // Seção 8: decodificação de ADD R0, R1, com os campos do IR (microetapa 25).
  await stepTo(page, 25);
  await page.locator('section[aria-labelledby="step-heading"]').screenshot({ path: `${OUT}/decodificacao.png` });

  // Seções 4 e 8: tela completa durante o cálculo da ULA (5 + 7 = 12, microetapa 27).
  await stepTo(page, 27);
  await page.screenshot({ path: `${OUT}/simulador.png` });

  // Seção 6.1: o display recebe o valor 12 (microetapa 36).
  await stepTo(page, 36);
  await diagram(page).screenshot({ path: `${OUT}/es-display.png` });

  // Seção 7: editor com o código de máquina de cada linha.
  await page.getByRole("button", { name: "Editor ▶" }).click();
  await page.locator('section[aria-labelledby="editor-heading"]').screenshot({ path: `${OUT}/editor.png` });

  // Seção 5: exemplo 2 executado até o HLT — abas Cache e Estatísticas.
  await page.getByLabel("Exemplos").selectOption("contador-laco");
  await page.getByRole("button", { name: "Montar e carregar" }).click();
  await page.getByRole("button", { name: /Recolher/ }).click();
  await page.getByLabel("Velocidade").selectOption("4");
  await page.getByRole("button", { name: "Executar (Espaço)" }).click();
  await page.getByRole("heading", { name: "HLT: fim da execução" }).waitFor({ timeout: 60_000 });
  const tabs = page.locator('section[aria-label^="Painéis de memória"]');
  await page.getByRole("tab", { name: "Estatísticas" }).click();
  await tabs.screenshot({ path: `${OUT}/estatisticas-exemplo2.png` });
  await page.getByRole("tab", { name: "Cache" }).click();
  await tabs.screenshot({ path: `${OUT}/cache-exemplo2.png` });

  // Seção 3: diagrama geral (página Sobre: estado final do exemplo 1, nada aceso).
  await page.goto("/sobre");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#diagrama svg.dg-root").screenshot({ path: `${OUT}/diagrama-geral.png` });

  // Seção 9: tour guiado, cena 5.
  await page.goto("/tour");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /Ciclo de busca, decodificação e execução ao vivo/ }).click();
  await page.screenshot({ path: `${OUT}/tour.png` });
});
