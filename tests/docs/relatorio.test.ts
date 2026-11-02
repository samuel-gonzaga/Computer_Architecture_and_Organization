// Coerência (§2, regra 1): o relatório não pode afirmar nada que o simulador não faça.
// Os números, tabelas e figuras citados são conferidos contra o motor e o repositório.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { serializeProgram } from "@/components/editor/programFile";
import { cacheStatistics } from "@/core/cache";
import { EXAMPLES } from "@/core/programs";
import type { ComponentId } from "@/core/types";
import { runSource, splitByInstruction } from "../core/helpers";

const REPORT_URL = new URL("../../docs/relatorio/relatorio.md", import.meta.url);
const REPORT = readFileSync(REPORT_URL, "utf8");

const PHASE: Record<string, string> = { FETCH: "Busca", DECODE: "Decodificação", EXECUTE: "Execução" };
const NAME: Partial<Record<ComponentId, string>> = { CONTROL_UNIT: "UC", ALU: "ULA", CACHE: "Cache", KEYBOARD: "Teclado" };

/** Linhas de dados da primeira tabela Markdown depois do título indicado. */
function tableAfter(heading: string): string[][] {
  const start = REPORT.indexOf(heading);
  expect(start, `título "${heading}" no relatório`).toBeGreaterThan(-1);
  const lines = REPORT.slice(start).split("\n");
  const first = lines.findIndex((line) => line.startsWith("|"));
  const rows: string[][] = [];
  for (const line of lines.slice(first + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(1, -1).split(" | ").map((cell) => cell.trim()));
  }
  return rows;
}

describe("relatório técnico", () => {
  const example1 = runSource(EXAMPLES[0].source, 5);
  const example2 = runSource(EXAMPLES[1].source);

  it("tem as seções da matriz de rastreabilidade (§11)", () => {
    for (const heading of [
      "## 1. Contextualização",
      "## 2. Arquitetura escolhida",
      "## 3. Diagrama geral",
      "## 4. CPU",
      "## 5. Hierarquia de memória",
      "## 6. Barramentos",
      "### 6.1 E/S mapeada em memória",
      "## 7. Fluxo de dados",
      "## 8. Ciclo de busca, decodificação e execução",
      "### 8.1 Execução passo a passo de `ADD R0, R1`",
      "## 9. Conclusão e trabalhos futuros",
      "## Referências",
      "## Apêndice A",
      "## Apêndice B",
    ]) {
      expect(REPORT).toContain(heading);
    }
    expect(REPORT).toContain("TANENBAUM");
    expect(REPORT).toContain("STALLINGS");
  });

  it("a tabela da seção 8.1 é a execução real de ADD R0, R1", () => {
    const add = splitByInstruction(example1.micros).find((group) => group.some((micro) => micro.instruction === "ADD R0, R1"))!;
    expect(tableAfter("### 8.1")).toEqual(
      add.map((micro, index) => [
        String(index + 1),
        PHASE[micro.phase],
        micro.title,
        micro.buses.control.join(", "),
        micro.activeComponents.map((id) => NAME[id] ?? id).join(", "),
        String(micro.cycle),
      ]),
    );
  });

  it("a tabela da seção 7 traz as microetapas e os ciclos de cada instrução do exemplo 1", () => {
    const groups = splitByInstruction(example1.micros);
    const rows = tableAfter("Com a entrada 5, a execução completa");
    expect(rows).toHaveLength(groups.length);
    groups.forEach((group, index) => {
      const before = example1.micros[example1.micros.indexOf(group[0]) - 1];
      const cycles = group[group.length - 1].cycle - before.cycle;
      const instruction = group.find((micro) => micro.instruction)!.instruction!;
      expect(rows[index].slice(0, 3)).toEqual([`\`${instruction}\``, String(group.length), String(cycles)]);
    });
    expect(REPORT).toContain(`42 microetapas (o boot e mais 41) e leva **${example1.state.cycle} ciclos**`);
  });

  it("os números da cache citados vêm da execução real", () => {
    const loop = cacheStatistics(example2.state.cache, example2.state.cycle);
    expect(REPORT).toContain(`**${loop.hits} de ${loop.hits + loop.misses} leituras são HIT (67,6%)**`);
    expect((loop.hitRate * 100).toFixed(1)).toBe("67.6");
    expect(REPORT).toContain(`**${loop.totalCycles} ciclos**, contra **${loop.cyclesWithoutCache} ciclos**`);
    expect(REPORT).toContain(`${loop.savedCycles} ciclos economizados, ${Math.round((loop.savedCycles / loop.cyclesWithoutCache) * 100)}% a menos`);

    const waits = example1.micros.reduce((sum, micro) => sum + (micro.waitCycles ?? 0), 0);
    expect(REPORT).toContain(`custam ${waits} ciclos de espera, ou ${Math.round((waits / example1.state.cycle) * 100)}% dos ${example1.state.cycle} ciclos`);
  });

  it("o código de máquina da seção 7 é o que o montador gera", () => {
    const rows = tableAfter("O montador do simulador gera o seguinte código de máquina");
    const disk = example1.state.disk;
    for (const [address, , code] of rows) {
      const index = parseInt(address.replaceAll("`", ""), 16);
      expect(code.replaceAll("`", "")).toBe(`0x${disk[index].toString(16).toUpperCase().padStart(4, "0")}`);
    }
  });

  it("o arquivo .neocore.json do Apêndice A é o que o editor exporta", () => {
    const block = /## Apêndice A[\s\S]*?```\n([\s\S]*?)```/.exec(REPORT)?.[1];
    expect(block).toBe(serializeProgram({ name: EXAMPLES[0].name, source: EXAMPLES[0].source, keyboard: 5 }));
  });

  it("todas as figuras citadas existem", () => {
    const images = [...REPORT.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
    expect(images.length).toBeGreaterThanOrEqual(10);
    for (const image of images) {
      expect(existsSync(new URL(image, REPORT_URL)), image).toBe(true);
    }
  });
});
