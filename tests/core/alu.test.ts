import { describe, expect, it } from "vitest";
import { aluExecute, toSigned16 } from "@/core/alu";
import type { Flags } from "@/core/types";

const CLEAR: Flags = { Z: false, N: false, C: false, V: false };
const SET: Flags = { Z: true, N: true, C: true, V: true };

describe("ULA — ADD", () => {
  it("soma sem alterar flags especiais", () => {
    expect(aluExecute("ADD", 5, 7, CLEAR)).toEqual({ result: 12, flags: CLEAR });
  });

  it("zero: 0 + 0 liga Z", () => {
    expect(aluExecute("ADD", 0, 0, CLEAR).flags).toEqual({ Z: true, N: false, C: false, V: false });
  });

  it("carry: 0xFFFF + 1 = 0 com C e Z (−1 + 1 sem overflow)", () => {
    expect(aluExecute("ADD", 0xffff, 1, CLEAR)).toEqual({
      result: 0,
      flags: { Z: true, N: false, C: true, V: false },
    });
  });

  it("overflow positivo: 0x7FFF + 1 = 0x8000 com V e N", () => {
    expect(aluExecute("ADD", 0x7fff, 1, CLEAR)).toEqual({
      result: 0x8000,
      flags: { Z: false, N: true, C: false, V: true },
    });
  });

  it("overflow negativo: 0x8000 + 0x8000 = 0 com V, C e Z", () => {
    expect(aluExecute("ADD", 0x8000, 0x8000, CLEAR)).toEqual({
      result: 0,
      flags: { Z: true, N: false, C: true, V: true },
    });
  });

  it("negativo sem overflow: −3 + 1 = −2", () => {
    const { result, flags } = aluExecute("ADD", 0xfffd, 1, CLEAR);
    expect(toSigned16(result)).toBe(-2);
    expect(flags).toEqual({ Z: false, N: true, C: false, V: false });
  });

  it("recalcula todas as flags, sem herdar o estado anterior", () => {
    expect(aluExecute("ADD", 1, 2, SET).flags).toEqual(CLEAR);
  });
});

describe("ULA — SUB", () => {
  it("subtrai sem alterar flags especiais", () => {
    expect(aluExecute("SUB", 10, 3, CLEAR)).toEqual({ result: 7, flags: CLEAR });
  });

  it("zero: 5 − 5 liga Z", () => {
    expect(aluExecute("SUB", 5, 5, SET).flags).toEqual({ Z: true, N: false, C: false, V: false });
  });

  it("empresta-um: 3 − 5 = −2 com N e C", () => {
    const { result, flags } = aluExecute("SUB", 3, 5, CLEAR);
    expect(result).toBe(0xfffe);
    expect(toSigned16(result)).toBe(-2);
    expect(flags).toEqual({ Z: false, N: true, C: true, V: false });
  });

  it("overflow: 0x8000 − 1 (−32768 − 1) = 0x7FFF com V", () => {
    expect(aluExecute("SUB", 0x8000, 1, CLEAR)).toEqual({
      result: 0x7fff,
      flags: { Z: false, N: false, C: false, V: true },
    });
  });

  it("overflow: 0x7FFF − 0xFFFF (32767 − (−1)) = 0x8000 com V, N e C", () => {
    expect(aluExecute("SUB", 0x7fff, 0xffff, CLEAR)).toEqual({
      result: 0x8000,
      flags: { Z: false, N: true, C: true, V: true },
    });
  });
});

describe("ULA — operações lógicas", () => {
  it("AND bit a bit", () => {
    expect(aluExecute("AND", 0b1100, 0b1010, CLEAR)).toEqual({ result: 0b1000, flags: CLEAR });
  });

  it("AND com resultado zero liga Z", () => {
    expect(aluExecute("AND", 0x00ff, 0xff00, CLEAR).flags.Z).toBe(true);
  });

  it("OR bit a bit com N", () => {
    expect(aluExecute("OR", 0x8000, 0x0001, CLEAR)).toEqual({
      result: 0x8001,
      flags: { Z: false, N: true, C: false, V: false },
    });
  });

  it("NOT inverte os 16 bits e ignora o segundo operando", () => {
    expect(aluExecute("NOT", 0x0000, 0x1234, CLEAR)).toEqual({
      result: 0xffff,
      flags: { Z: false, N: true, C: false, V: false },
    });
    expect(aluExecute("NOT", 0xffff, 0, CLEAR).result).toBe(0);
    expect(aluExecute("NOT", 0xffff, 0, CLEAR).flags.Z).toBe(true);
  });

  it("preservam C e V do estado anterior", () => {
    const previous: Flags = { Z: true, N: true, C: true, V: true };
    expect(aluExecute("AND", 1, 1, previous).flags).toEqual({ Z: false, N: false, C: true, V: true });
    expect(aluExecute("OR", 0, 0, { ...CLEAR, C: true }).flags).toEqual({ Z: true, N: false, C: true, V: false });
    expect(aluExecute("NOT", 0x8000, 0, { ...CLEAR, V: true }).flags).toEqual({
      Z: false,
      N: false,
      C: false,
      V: true,
    });
  });
});

describe("toSigned16", () => {
  it("interpreta complemento de dois", () => {
    expect(toSigned16(0)).toBe(0);
    expect(toSigned16(0x7fff)).toBe(32767);
    expect(toSigned16(0x8000)).toBe(-32768);
    expect(toSigned16(0xffff)).toBe(-1);
  });
});
