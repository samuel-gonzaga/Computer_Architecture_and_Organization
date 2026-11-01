import { describe, expect, it } from "vitest";
import {
  decode,
  encode,
  extractFields,
  formatInstruction,
  ISA,
  specForMnemonic,
  specForOpcode,
  toHex,
} from "@/core/isa";
import type { Instruction, Mnemonic, RegisterIndex } from "@/core/types";

const REGISTERS: RegisterIndex[] = [0, 1, 2, 3];

describe("tabela da ISA", () => {
  it("tem os 14 opcodes da §4.4, sem repetição", () => {
    const expected: [Mnemonic, number][] = [
      ["NOP", 0x0], ["LOAD", 0x1], ["STORE", 0x2], ["LDI", 0x3], ["MOV", 0x4],
      ["ADD", 0x5], ["SUB", 0x6], ["AND", 0x7], ["OR", 0x8], ["NOT", 0x9],
      ["JMP", 0xa], ["JZ", 0xb], ["JN", 0xc], ["HLT", 0xf],
    ];
    expect(ISA.map((spec) => [spec.mnemonic, spec.opcode])).toEqual(expected);
    expect(new Set(ISA.map((spec) => spec.opcode)).size).toBe(14);
  });

  it("declara as flags afetadas de cada instrução", () => {
    expect(specForMnemonic("ADD")?.affectedFlags).toEqual(["Z", "N", "C", "V"]);
    expect(specForMnemonic("SUB")?.affectedFlags).toEqual(["Z", "N", "C", "V"]);
    expect(specForMnemonic("AND")?.affectedFlags).toEqual(["Z", "N"]);
    expect(specForMnemonic("OR")?.affectedFlags).toEqual(["Z", "N"]);
    expect(specForMnemonic("NOT")?.affectedFlags).toEqual(["Z", "N"]);
    expect(specForMnemonic("MOV")?.affectedFlags).toEqual([]);
  });

  it("busca por mnemônico sem diferenciar maiúsculas e por opcode", () => {
    expect(specForMnemonic("add")?.opcode).toBe(0x5);
    expect(specForMnemonic("Hlt")?.opcode).toBe(0xf);
    expect(specForMnemonic("FOO")).toBeUndefined();
    expect(specForOpcode(0xa)?.mnemonic).toBe("JMP");
    expect(specForOpcode(0xd)).toBeUndefined();
    expect(specForOpcode(0xe)).toBeUndefined();
  });
});

describe("encode", () => {
  it("codifica os exemplos da §4.4", () => {
    expect(encode({ mnemonic: "LDI", rd: 1, rs: 0, operand: 5 })).toBe(0x3405);
    expect(encode({ mnemonic: "ADD", rd: 1, rs: 2, operand: 0 })).toBe(0x5600);
  });

  it("posiciona cada campo nos bits corretos", () => {
    // 0010 11 00 11110001 → STORE R3, [0xF1]
    expect(encode({ mnemonic: "STORE", rd: 3, rs: 0, operand: 0xf1 })).toBe(0b0010_11_00_11110001);
    expect(encode({ mnemonic: "MOV", rd: 0, rs: 3, operand: 0 })).toBe(0x4300);
    expect(encode({ mnemonic: "HLT", rd: 0, rs: 0, operand: 0 })).toBe(0xf000);
  });

  it("rejeita campos fora do intervalo", () => {
    expect(() => encode({ mnemonic: "LDI", rd: 0, rs: 0, operand: 256 })).toThrow(RangeError);
    expect(() => encode({ mnemonic: "LDI", rd: 0, rs: 0, operand: -1 })).toThrow(RangeError);
    expect(() => encode({ mnemonic: "LDI", rd: 0, rs: 0, operand: 1.5 })).toThrow(RangeError);
    expect(() => encode({ mnemonic: "ADD", rd: 4 as RegisterIndex, rs: 0, operand: 0 })).toThrow(RangeError);
    expect(() => encode({ mnemonic: "ADD", rd: 0, rs: -1 as RegisterIndex, operand: 0 })).toThrow(RangeError);
    expect(() => encode({ mnemonic: "XYZ" as Mnemonic, rd: 0, rs: 0, operand: 0 })).toThrow(RangeError);
  });
});

describe("decode", () => {
  it("decodifica os exemplos da §4.4", () => {
    expect(decode(0x3405)).toEqual({
      valid: true,
      fields: { opcode: 0x3, rd: 1, rs: 0, operand: 5 },
      instruction: { mnemonic: "LDI", rd: 1, rs: 0, operand: 5 },
    });
    const add = decode(0x5600);
    expect(add.valid && add.instruction).toEqual({ mnemonic: "ADD", rd: 1, rs: 2, operand: 0 });
  });

  it("trata opcodes reservados como instrução inválida, sem lançar exceção", () => {
    for (const word of [0xd000, 0xe5ff]) {
      const result = decode(word);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/^Instrução inválida: o opcode 0x[DE] é reservado\.$/);
        expect(result.fields.opcode).toBe(word >> 12);
      }
    }
  });

  it("rejeita valores que não são palavras de 16 bits", () => {
    expect(() => extractFields(0x10000)).toThrow(RangeError);
    expect(() => extractFields(-1)).toThrow(RangeError);
    expect(() => decode(1.5)).toThrow(RangeError);
  });
});

describe("ida e volta encode ↔ decode", () => {
  it("decode(encode(i)) devolve a mesma instrução para os 14 opcodes", () => {
    for (const spec of ISA) {
      for (const rd of REGISTERS) {
        for (const rs of REGISTERS) {
          for (const operand of [0x00, 0x01, 0x7f, 0x80, 0xf0, 0xff]) {
            const instruction: Instruction = { mnemonic: spec.mnemonic, rd, rs, operand };
            const result = decode(encode(instruction));
            expect(result.valid && result.instruction).toEqual(instruction);
          }
        }
      }
    }
  });

  it("encode(decode(w)) === w para todas as 65.536 palavras com opcode válido", () => {
    let validWords = 0;
    for (let word = 0; word <= 0xffff; word++) {
      const result = decode(word);
      if (result.valid) {
        validWords++;
        if (encode(result.instruction) !== word) {
          throw new Error(`Falhou na palavra ${toHex(word, 4)}`);
        }
      } else {
        expect([0xd, 0xe]).toContain(result.fields.opcode);
      }
    }
    expect(validWords).toBe(14 * 4096);
  });
});

describe("formatInstruction e toHex", () => {
  it("escreve cada formato de operandos em assembly", () => {
    const text = (mnemonic: Mnemonic, rd: RegisterIndex, rs: RegisterIndex, operand: number) =>
      formatInstruction({ mnemonic, rd, rs, operand });
    expect(text("NOP", 0, 0, 0)).toBe("NOP");
    expect(text("HLT", 0, 0, 0)).toBe("HLT");
    expect(text("NOT", 2, 0, 0)).toBe("NOT R2");
    expect(text("ADD", 0, 1, 0)).toBe("ADD R0, R1");
    expect(text("LDI", 1, 0, 5)).toBe("LDI R1, 5");
    expect(text("LOAD", 0, 0, 0xf0)).toBe("LOAD R0, [0xF0]");
    expect(text("STORE", 0, 0, 0xf1)).toBe("STORE R0, [0xF1]");
    expect(text("JZ", 0, 0, 0x0a)).toBe("JZ 0x0A");
  });

  it("formata hexadecimal com zeros à esquerda e dígitos maiúsculos", () => {
    expect(toHex(0xf0, 2)).toBe("0xF0");
    expect(toHex(5, 2)).toBe("0x05");
    expect(toHex(0x3405, 4)).toBe("0x3405");
    expect(toHex(0xd, 1)).toBe("0xD");
  });
});
