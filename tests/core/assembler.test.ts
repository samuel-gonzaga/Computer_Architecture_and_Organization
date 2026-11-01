import { describe, expect, it } from "vitest";
import { assemble, type AssembleResult } from "@/core/assembler";

function program(source: string): number[] {
  const result = assemble(source);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }
  return result.program;
}

function errors(source: string): string[] {
  const result: AssembleResult = assemble(source);
  if (result.ok) {
    throw new Error("A montagem deveria ter falhado");
  }
  return result.errors.map((error) => error.message);
}

const EXAMPLE_1 = `
LOAD  R0, [0xF0]   ; lê número do teclado (E/S)
LOAD  R1, [0x20]   ; lê constante da memória
ADD   R0, R1       ; ULA soma
STORE R0, [0xF1]   ; mostra no display (E/S)
HLT
.org 0x20
.word 7
`;

describe("assembler — programas válidos", () => {
  it("monta o exemplo 1 da §6.3", () => {
    const words = program(EXAMPLE_1);
    expect(words).toHaveLength(0x21);
    expect(words.slice(0, 5)).toEqual([0x10f0, 0x1420, 0x5100, 0x20f1, 0xf000]);
    expect(words.slice(5, 0x20).every((word) => word === 0)).toBe(true); // lacuna do .org = NOP
    expect(words[0x20]).toBe(7);
  });

  it("monta os exemplos de codificação da §4.4", () => {
    expect(program("LDI R1, 5\nADD R1, R2")).toEqual([0x3405, 0x5600]);
  });

  it("monta todas as instruções da ISA", () => {
    const source = [
      "NOP", "LOAD R1, [0x10]", "STORE R2, [0xF1]", "LDI R3, 255", "MOV R0, R3",
      "ADD R0, R1", "SUB R1, R2", "AND R2, R3", "OR R3, R0", "NOT R1",
      "JMP 0x05", "JZ 0x06", "JN 0x07", "HLT",
    ].join("\n");
    expect(program(source)).toEqual([
      0x0000, 0x1410, 0x28f1, 0x3cff, 0x4300, 0x5100, 0x6600, 0x7b00, 0x8c00, 0x9400,
      0xa005, 0xb006, 0xc007, 0xf000,
    ]);
  });

  it("aceita minúsculas, espaços variados, linhas CRLF e comentários", () => {
    expect(program("  ldi r1,5   ; comentário\r\n\r\n; só comentário\r\nadd   r1 ,  r2")).toEqual([0x3405, 0x5600]);
  });

  it("resolve rótulos para trás e para frente", () => {
    const words = program(`
      start:  LDI R0, 3
      loop:   SUB R0, R1
              JZ fim
              JMP loop
      fim:    HLT
              JMP start
    `);
    expect(words).toEqual([0x3003, 0x6100, 0xb004, 0xa001, 0xf000, 0xa000]);
  });

  it("aceita rótulo sozinho na linha e rótulo como operando de LOAD, LDI e .word", () => {
    const words = program(`
      LOAD R0, [dado]
      LDI R1, dado
      HLT
      dado:
      .word fim
      fim: .word 0x1234
    `);
    expect(words).toEqual([0x1003, 0x3403, 0xf000, 0x0004, 0x1234]);
  });

  it("aceita .word com valor negativo (complemento de dois) e limites de 16 bits", () => {
    expect(program(".word -1\n.word -32768\n.word 65535\n.word 0")).toEqual([0xffff, 0x8000, 0xffff, 0]);
  });

  it("permite .org para trás quando não há sobreposição", () => {
    expect(program(".org 0x02\nHLT\n.org 0x00\nNOP")).toEqual([0x0000, 0x0000, 0xf000]);
  });

  it("monta programa vazio", () => {
    expect(program("; nada aqui\n\n")).toEqual([]);
  });

  it("gera a listagem com endereço e código de máquina por linha", () => {
    const result = assemble("inicio: LDI R1, 5 ; carrega\n\n.org 0x10\n.word 7");
    expect(result.ok && result.listing).toEqual([
      { line: 1, source: "inicio: LDI R1, 5 ; carrega", address: 0x00, word: 0x3405, kind: "instruction" },
      { line: 2, source: "" },
      { line: 3, source: ".org 0x10" },
      { line: 4, source: ".word 7", address: 0x10, word: 7, kind: "data" },
    ]);
  });
});

describe("assembler — erros por linha em português", () => {
  it("registrador inválido (mensagem da §6.4)", () => {
    expect(errors("NOP\nNOP\nADD R5, R1")).toEqual(["Linha 3: registrador inválido 'R5'"]);
    expect(errors("MOV R0, 7")).toEqual(["Linha 1: registrador inválido '7'"]);
  });

  it("instrução e diretiva desconhecidas", () => {
    expect(errors("MUL R0, R1")).toEqual(["Linha 1: instrução desconhecida 'MUL'"]);
    expect(errors(".byte 3")).toEqual(["Linha 1: diretiva desconhecida '.byte'"]);
  });

  it("quantidade errada de operandos", () => {
    expect(errors("ADD R0")).toEqual(["Linha 1: 'ADD' espera 2 operandos (rd, rs), mas recebeu 1"]);
    expect(errors("NOT R0, R1")).toEqual(["Linha 1: 'NOT' espera 1 operando (rd), mas recebeu 2"]);
    expect(errors("LOAD [0x20]")).toEqual(["Linha 1: 'LOAD' espera 2 operandos (rd, [addr]), mas recebeu 1"]);
    expect(errors("HLT R0")).toEqual(["Linha 1: 'HLT' não recebe operandos, mas recebeu 1"]);
  });

  it("endereço de LOAD/STORE sem colchetes", () => {
    expect(errors("STORE R0, 0xF1")).toEqual([
      "Linha 1: endereço de memória deve estar entre colchetes, ex.: [0x20] (recebeu '0xF1')",
    ]);
  });

  it("valores fora do intervalo", () => {
    expect(errors("LDI R0, 256")).toEqual(["Linha 1: imediato fora do intervalo 0–255: 256"]);
    expect(errors("LDI R0, -1")).toEqual(["Linha 1: imediato fora do intervalo 0–255: -1"]);
    expect(errors("LOAD R0, [0x100]")).toEqual(["Linha 1: endereço fora do intervalo 0x00–0xFF: 0x100"]);
    expect(errors("JMP 300")).toEqual(["Linha 1: endereço fora do intervalo 0x00–0xFF: 300"]);
    expect(errors(".word 65536")).toEqual(["Linha 1: valor fora do intervalo de 16 bits: 65536"]);
    expect(errors(".word -32769")).toEqual(["Linha 1: valor fora do intervalo de 16 bits: -32769"]);
  });

  it("valor inválido e rótulo não definido", () => {
    expect(errors("LDI R0, 12abc")).toEqual(["Linha 1: valor inválido '12abc'"]);
    expect(errors("JMP fim")).toEqual(["Linha 1: rótulo não definido 'fim'"]);
    expect(errors(".word nada")).toEqual(["Linha 1: rótulo não definido 'nada'"]);
  });

  it("rótulo duplicado", () => {
    expect(errors("a: NOP\na: HLT")).toEqual(["Linha 2: rótulo 'a' já definido na linha 1"]);
  });

  it("erros de .org e .word", () => {
    expect(errors(".org")).toEqual(["Linha 1: '.org' espera 1 operando (endereço), mas recebeu 0"]);
    expect(errors(".org rotulo")).toEqual(["Linha 1: '.org' espera um endereço numérico, mas recebeu 'rotulo'"]);
    expect(errors(".org 0xF0")).toEqual(["Linha 1: '.org' fora da área de programa (0x00–0xEF): 0xF0"]);
    expect(errors(".org -1")).toEqual(["Linha 1: '.org' fora da área de programa (0x00–0xEF): -1"]);
    expect(errors(".word 1, 2")).toEqual(["Linha 1: '.word' espera 1 operando (valor), mas recebeu 2"]);
  });

  it("programa que invade a região de E/S", () => {
    expect(errors(".org 0xEF\nNOP\nHLT")).toEqual(["Linha 3: o programa invade a região de E/S (0xF0–0xFF)"]);
  });

  it("sobreposição de endereços causada por .org", () => {
    expect(errors("NOP\nNOP\n.org 0x01\nHLT")).toEqual(["Linha 4: o endereço 0x01 já foi ocupado pela linha 2"]);
  });

  it("coleta todos os erros, ordenados por linha, e não gera programa", () => {
    const result = assemble("ADD R5, R9\nFOO\nJMP nada");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      { line: 1, message: "Linha 1: registrador inválido 'R5'" },
      { line: 1, message: "Linha 1: registrador inválido 'R9'" },
      { line: 2, message: "Linha 2: instrução desconhecida 'FOO'" },
      { line: 3, message: "Linha 3: rótulo não definido 'nada'" },
    ]);
  });
});
