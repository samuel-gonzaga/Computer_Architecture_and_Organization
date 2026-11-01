// Painéis renderizados com react-dom/server a partir de estados reais do motor.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CachePanel } from "@/components/panels/CachePanel";
import { InstructionBits } from "@/components/panels/InstructionBits";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { RegistersPanel } from "@/components/panels/RegistersPanel";
import { executionStats } from "@/components/panels/stats";
import { StatsPanel } from "@/components/panels/StatsPanel";
import { StepExplanation } from "@/components/panels/StepExplanation";
import { createMachine, step } from "@/core/machine";
import { EXAMPLES } from "@/core/programs";
import type { Frame } from "@/store/simulation";
import { assembleOrThrow } from "../core/helpers";

function framesOf(source: string, keyboard = 0): Frame[] {
  const frames: Frame[] = [{ machine: createMachine(assembleOrThrow(source), { keyboard }) }];
  while (!frames[frames.length - 1].machine.halted) {
    const result = step(frames[frames.length - 1].machine);
    frames.push({ machine: result.state, micro: result.micro });
  }
  return frames;
}

const EXAMPLE_1 = framesOf(EXAMPLES[0].source, 5);
const find = (frames: Frame[], title: string) => frames.find((frame) => frame.micro?.title === title)!;

describe("InstructionBits", () => {
  it("separa a instrução em opcode | rd | rs | imm/addr", () => {
    const markup = renderToStaticMarkup(<InstructionBits word={0x3405} showLabels />);
    expect(markup).toContain('aria-label="opcode 0011, rd 01, rs 00, imm/addr 00000101"');
    expect(markup).toMatch(/text-field-op">0011<[\s\S]*text-field-rd">01<[\s\S]*text-field-rs">00<[\s\S]*text-field-imm">00000101</);
    expect(markup).toContain(">imm/addr<");
  });

  it("mostra dados como binário simples", () => {
    expect(renderToStaticMarkup(<InstructionBits word={7} kind="data" />)).toContain("0000 0000 0000 0111");
  });
});

describe("StepExplanation", () => {
  it("antes do boot, explica o que vai acontecer", () => {
    const markup = renderToStaticMarkup(<StepExplanation machine={EXAMPLE_1[0].machine} />);
    expect(markup).toContain("Pronto para o boot");
  });

  it("renderiza exatamente o título e a explicação do motor, com fase, ciclo e alterações", () => {
    const frame = find(EXAMPLE_1, "R0 ← resultado");
    const markup = renderToStaticMarkup(<StepExplanation machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain(frame.micro!.title);
    expect(markup).toContain(frame.micro!.explanation);
    expect(markup).toContain("Execução");
    expect(markup).toContain(`ciclo ${frame.micro!.cycle}`);
    expect(markup).toContain("R0: 0x0005 → 0x000C");
  });

  it("na decodificação, mostra os campos do IR", () => {
    const frame = EXAMPLE_1.find((candidate) => candidate.micro?.phase === "DECODE")!;
    const markup = renderToStaticMarkup(<StepExplanation machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain("Campos do IR (0x10F0)");
  });

  it("mostra o evento da cache, a espera e o aviso", () => {
    const frame = EXAMPLE_1[3]; // MEM_READ da 1ª busca: MISS
    const markup = renderToStaticMarkup(<StepExplanation machine={frame.machine} micro={frame.micro} notice="Atenção" />);
    expect(markup).toContain("MISS · linha 0 · tag 0x00");
    expect(markup).toContain("+4 ciclos (RAM)");
    expect(markup).toContain('role="alert"');
  });
});

describe("RegistersPanel", () => {
  it("mostra hex, decimal e binário, e marca o que mudou para piscar", () => {
    const frame = find(EXAMPLE_1, "R0 ← resultado");
    const markup = renderToStaticMarkup(<RegistersPanel machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain("R0, uso geral: 0x000C, decimal 12, binário 0000 0000 0000 1100, alterado");
    expect(markup).toMatch(/data-changed="true"[^>]*class="[^"]*flash/);
    expect(markup).toContain("Z (zero) = 0");
  });

  it("mostra o valor com sinal só nos registradores de dados", () => {
    const frames = framesOf("LDI R1, 1\nNOT R1\nHLT");
    const markup = renderToStaticMarkup(<RegistersPanel machine={frames[frames.length - 1].machine} />);
    expect(markup).toContain("65534 (−2)"); // R1 = NOT 1
    expect(markup).toContain('text-ink-muted">61440</span>'); // IR = HLT (0xF000): instrução, sem sinal
    expect(markup).toContain("61440 (−4096)"); // MDR = a mesma palavra, vista como dado
  });
});

describe("MemoryPanel", () => {
  it("destaca o PC, o endereço acessado e o valor alterado", () => {
    const read = find(EXAMPLE_1, "MDR ← M[MAR]"); // 1ª busca: o PC ainda aponta para 0x00
    expect(renderToStaticMarkup(<MemoryPanel machine={read.machine} micro={read.micro} />)).toContain(
      'aria-label="0x00 = 0x10F0 (4336), PC, acessado"',
    );
    const end = EXAMPLE_1[EXAMPLE_1.length - 1];
    expect(renderToStaticMarkup(<MemoryPanel machine={end.machine} micro={end.micro} />)).toContain(
      'aria-label="0x05 = 0x0000 (0), PC"',
    );

    const boot = EXAMPLE_1[1];
    expect(renderToStaticMarkup(<MemoryPanel machine={boot.machine} micro={boot.micro} />)).toContain("0x20 = 0x0007 (7), alterado");
  });

  it("mostra a região de E/S como dispositivos, não como RAM", () => {
    const frame = EXAMPLE_1[EXAMPLE_1.length - 1];
    const markup = renderToStaticMarkup(<MemoryPanel machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain('title="0xF0: teclado = 5"');
    expect(markup).toContain('title="0xF1: display = 12"');
    expect(markup).toContain('title="0xF5: sem dispositivo"');
  });
});

describe("CachePanel", () => {
  it("explica a divisão do endereço em tag e índice", () => {
    const frame = EXAMPLE_1.find((candidate) => candidate.micro?.cache?.type === "MISS" && candidate.micro.buses.address === 0x20)!;
    const markup = renderToStaticMarkup(<CachePanel machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain("Acesso a 0x20: MISS (falta)");
    expect(markup).toContain("00100000");
    expect(markup).toContain("tag 00100");
    expect(markup).toContain("índice 000");
    expect(markup).toContain('aria-current="true"');
  });

  it("explica o bypass da E/S", () => {
    const frame = EXAMPLE_1.find((candidate) => candidate.micro?.cache?.type === "BYPASS")!;
    const markup = renderToStaticMarkup(<CachePanel machine={frame.machine} micro={frame.micro} />);
    expect(markup).toContain("BYPASS (E/S)");
    expect(markup).not.toContain('aria-current="true"');
  });
});

describe("Estatísticas", () => {
  it("contam microetapas, instruções, CPI e o ganho da cache no exemplo 2", () => {
    const frames = framesOf(EXAMPLES[1].source);
    const stats = executionStats(frames, frames.length - 1);
    expect(stats).toMatchObject({
      microSteps: 214,
      instructions: 29,
      totalCycles: 258,
      hits: 23,
      misses: 11,
      savedCycles: 92,
      cyclesWithoutCache: 350,
    });
    expect(stats.cyclesPerInstruction).toBeCloseTo(258 / 29);
    const markup = renderToStaticMarkup(<StatsPanel stats={stats} />);
    expect(markup).toContain("67,6%");
    expect(markup).toContain("<strong class=\"text-ink\">350</strong>");
  });

  it("antes de executar, não há taxa nem CPI", () => {
    const stats = executionStats(EXAMPLE_1, 0);
    expect(stats.cyclesPerInstruction).toBeUndefined();
    expect(renderToStaticMarkup(<StatsPanel stats={stats} />)).toContain(">—<");
  });
});
