import { describe, expect, it } from "vitest";
import { assemble } from "@/core/assembler";
import { EXAMPLES, type ExampleProgram } from "@/core/programs";
import { runSource } from "./helpers";

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
