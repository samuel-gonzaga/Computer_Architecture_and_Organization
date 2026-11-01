import { describe, expect, it } from "vitest";
import { assemble } from "@/core/assembler";
import { cacheStatistics } from "@/core/cache";
import { EXAMPLES, type ExampleProgram } from "@/core/programs";
import { runSource, splitByInstruction } from "./helpers";

function example(id: string): ExampleProgram {
  const found = EXAMPLES.find((program) => program.id === id);
  if (!found) {
    throw new Error(`Exemplo não encontrado: ${id}`);
  }
  return found;
}

function runExample(id: string, keyboard?: number) {
  const program = example(id);
  return runSource(program.source, keyboard ?? program.keyboard);
}

describe("programas de exemplo (§6.3)", () => {
  it("são 3, com identificadores únicos, e todos montam sem erros", () => {
    expect(EXAMPLES.map((program) => program.id)).toEqual(["soma-simples", "contador-laco", "logica-bits"]);
    for (const program of EXAMPLES) {
      expect(assemble(program.source).ok).toBe(true);
    }
  });

  it("exemplo 1 — soma simples: entrada 5 no teclado, display mostra 12", () => {
    const { state, micros } = runExample("soma-simples");
    expect(state.error).toBeUndefined();
    expect(state).toMatchObject({
      halted: true,
      registers: [12, 7, 0, 0],
      io: { keyboard: 5, display: 12, led: 0 },
      pc: 0x05,
      cycle: 65,
    });
    expect(micros).toHaveLength(42);
  });

  it("exemplo 1 — sequência completa de microetapas (golden)", () => {
    expect(runExample("soma-simples").micros).toMatchSnapshot();
  });

  it("exemplo 1 — funciona com outras entradas", () => {
    expect(runExample("soma-simples", 30).state.io.display).toBe(37);
  });

  it("exemplo 2 — contador com laço: mostra 5…0 e acende o LED", () => {
    const { state, micros } = runExample("contador-laco");
    expect(state.error).toBeUndefined();
    expect(state).toMatchObject({
      halted: true,
      registers: [0, 1, 1, 0],
      io: { display: 0, led: 1 },
    });
    expect(state.flags.Z).toBe(true);
    const shown = micros.flatMap((micro) => micro.changes.filter((change) => change.target === "DISPLAY").map((change) => change.to));
    expect(shown).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("exemplo 1 — sem repetição de endereços, a cache só tem MISS", () => {
    const { state } = runExample("soma-simples");
    expect(cacheStatistics(state.cache, state.cycle)).toEqual({
      hits: 0,
      misses: 6, // 5 buscas de instrução + LOAD [0x20]; os acessos à E/S fazem bypass
      hitRate: 0,
      totalCycles: 65,
      savedCycles: 0,
      cyclesWithoutCache: 65,
    });
  });

  it("exemplo 2 — o laço reaproveita a cache: taxa de acerto > 0", () => {
    const { state, micros } = runExample("contador-laco");
    const stats = cacheStatistics(state.cache, state.cycle);
    // MISS: LDI inicial + 1ª volta (5 buscas + 1 dado) + 4 instruções depois do laço = 11.
    // HIT: voltas 2 a 4 (5 buscas + 1 dado) + 5ª volta, que sai pelo JZ sem o JMP (4 + 1) = 23.
    expect(stats).toEqual({
      hits: 23,
      misses: 11,
      hitRate: 23 / 34,
      totalCycles: 258,
      savedCycles: 92,
      cyclesWithoutCache: 350, // o mesmo programa custava 350 ciclos antes da cache (Fase 2)
    });
    expect(stats.hitRate).toBeGreaterThan(0);

    // A partir da 2ª volta, as instruções do laço vêm da cache.
    const loopFetches = splitByInstruction(micros)
      .filter((group) => group[0].buses.address !== undefined && group[0].buses.address >= 1 && group[0].buses.address <= 5)
      .map((group) => group[1].cache?.type);
    expect(loopFetches.slice(0, 5)).toEqual(["MISS", "MISS", "MISS", "MISS", "MISS"]);
    expect(loopFetches.slice(5).every((type) => type === "HIT")).toBe(true);
  });

  it("exemplo 3 — lógica bit a bit: AND, OR e NOT com máscara", () => {
    const { state } = runExample("logica-bits");
    expect(state.error).toBeUndefined();
    expect(state).toMatchObject({
      halted: true,
      registers: [0x00c0, 0xfff0, 0x000a, 0x00cf],
      io: { display: 10, led: 0x00cf },
      flags: { Z: false, N: false, C: false, V: false },
    });
  });
});
