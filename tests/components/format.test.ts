import { describe, expect, it } from "vitest";
import { parseWordInput, toBinary, toDecimal } from "@/components/format";
import {
  parseProgramFile,
  PROGRAM_FILE_FORMAT,
  programFileName,
  serializeProgram,
} from "@/components/editor/programFile";

describe("formatação de valores", () => {
  it("binário agrupado de 4 em 4", () => {
    expect(toBinary(0x00ca)).toBe("0000 0000 1100 1010");
    expect(toBinary(0xf0, 8)).toBe("1111 0000");
  });

  it("decimal com sinal quando o bit 15 está ligado", () => {
    expect(toDecimal(12)).toBe("12");
    expect(toDecimal(0xffff)).toBe("65535 (−1)");
    expect(toDecimal(0x8000)).toBe("32768 (−32768)");
  });
});

describe("entrada do teclado", () => {
  it("aceita decimal, negativo (complemento de dois) e hexadecimal", () => {
    expect(parseWordInput("5")).toBe(5);
    expect(parseWordInput(" 65535 ")).toBe(0xffff);
    expect(parseWordInput("-1")).toBe(0xffff);
    expect(parseWordInput("−2")).toBe(0xfffe);
    expect(parseWordInput("0x00F0")).toBe(0xf0);
    expect(parseWordInput("0XfF")).toBe(0xff);
  });

  it("rejeita texto inválido e valores fora de 16 bits", () => {
    for (const text of ["", "abc", "5.5", "0x", "0x10000", "65536", "-32769", "1e3"]) {
      expect(parseWordInput(text), text).toBeUndefined();
    }
  });
});

describe("arquivo .neocore.json (R13)", () => {
  it("salva e lê de volta o mesmo programa", () => {
    const text = serializeProgram({ name: "Soma simples", source: "LDI R0, 1\nHLT\n", keyboard: 5 });
    expect(JSON.parse(text)).toEqual({
      format: PROGRAM_FILE_FORMAT,
      version: 1,
      name: "Soma simples",
      source: "LDI R0, 1\nHLT\n",
      keyboard: 5,
    });
    expect(parseProgramFile(text)).toEqual({ ok: true, file: JSON.parse(text) });
  });

  it("completa nome e teclado ausentes", () => {
    const result = parseProgramFile(JSON.stringify({ format: PROGRAM_FILE_FORMAT, version: 1, source: "HLT", name: "  " }));
    expect(result).toMatchObject({ ok: true, file: { name: "Programa importado", keyboard: 0 } });
  });

  it("explica por que um arquivo não pode ser importado", () => {
    const valid = { format: PROGRAM_FILE_FORMAT, version: 1, name: "x", source: "HLT", keyboard: 0 };
    const cases: [string, string][] = [
      ["{ não é json", "O arquivo não é um JSON válido."],
      ["null", "O arquivo não é um programa do NeoCore Computer Lab."],
      [JSON.stringify({ ...valid, format: "outro" }), "O arquivo não é um programa do NeoCore Computer Lab."],
      [JSON.stringify({ ...valid, version: 2 }), "Versão de arquivo não suportada: 2."],
      [JSON.stringify({ ...valid, source: 42 }), "O arquivo não contém o código do programa."],
      [JSON.stringify({ ...valid, keyboard: 70000 }), "A entrada do teclado no arquivo deve ser um número de 0 a 65535."],
      [JSON.stringify({ ...valid, keyboard: "5" }), "A entrada do teclado no arquivo deve ser um número de 0 a 65535."],
    ];
    for (const [text, error] of cases) {
      expect(parseProgramFile(text)).toEqual({ ok: false, error });
    }
  });

  it("gera um nome de arquivo a partir do nome do programa", () => {
    expect(programFileName("Soma simples")).toBe("soma-simples.neocore.json");
    expect(programFileName("Lógica bit a bit!")).toBe("logica-bit-a-bit.neocore.json");
    expect(programFileName("???")).toBe("programa.neocore.json");
  });
});
