// Conjunto de instruções NeoCore-8: tabela de opcodes, codificação e decodificação (§4.3 e §4.4).
//
//  15    12 11  10 9    8 7              0
// [ opcode ][  rd  ][  rs  ][ imm / addr ]

import type {
  Flags,
  Instruction,
  InstructionFields,
  Mnemonic,
  RegisterIndex,
  Word,
} from "./types";

/** Máscara de uma palavra de 16 bits. */
export const WORD_MASK = 0xffff;

/** Máscara do campo imm/addr (8 bits). */
export const OPERAND_MASK = 0xff;

/** Como os operandos de cada instrução são escritos em assembly. */
export type OperandFormat =
  | "NONE" // NOP, HLT
  | "RD" // NOT rd
  | "RD_RS" // MOV/ADD/SUB/AND/OR rd, rs
  | "RD_IMM" // LDI rd, imm
  | "RD_ADDR" // LOAD/STORE rd, [addr]
  | "ADDR"; // JMP/JZ/JN addr

export type InstructionSpec = {
  readonly mnemonic: Mnemonic;
  readonly opcode: number;
  readonly format: OperandFormat;
  readonly operation: string; // operação em notação de transferência entre registradores
  readonly affectedFlags: readonly (keyof Flags)[];
};

/** Tabela da ISA (§4.4). Opcodes 0xD e 0xE são reservados. */
export const ISA: readonly InstructionSpec[] = [
  { mnemonic: "NOP", opcode: 0x0, format: "NONE", operation: "nada", affectedFlags: [] },
  { mnemonic: "LOAD", opcode: 0x1, format: "RD_ADDR", operation: "rd ← M[addr]", affectedFlags: [] },
  { mnemonic: "STORE", opcode: 0x2, format: "RD_ADDR", operation: "M[addr] ← rd", affectedFlags: [] },
  { mnemonic: "LDI", opcode: 0x3, format: "RD_IMM", operation: "rd ← imm", affectedFlags: [] },
  { mnemonic: "MOV", opcode: 0x4, format: "RD_RS", operation: "rd ← rs", affectedFlags: [] },
  { mnemonic: "ADD", opcode: 0x5, format: "RD_RS", operation: "rd ← rd + rs", affectedFlags: ["Z", "N", "C", "V"] },
  { mnemonic: "SUB", opcode: 0x6, format: "RD_RS", operation: "rd ← rd − rs", affectedFlags: ["Z", "N", "C", "V"] },
  { mnemonic: "AND", opcode: 0x7, format: "RD_RS", operation: "rd ← rd & rs", affectedFlags: ["Z", "N"] },
  { mnemonic: "OR", opcode: 0x8, format: "RD_RS", operation: "rd ← rd | rs", affectedFlags: ["Z", "N"] },
  { mnemonic: "NOT", opcode: 0x9, format: "RD", operation: "rd ← ~rd", affectedFlags: ["Z", "N"] },
  { mnemonic: "JMP", opcode: 0xa, format: "ADDR", operation: "PC ← addr", affectedFlags: [] },
  { mnemonic: "JZ", opcode: 0xb, format: "ADDR", operation: "se Z=1, PC ← addr", affectedFlags: [] },
  { mnemonic: "JN", opcode: 0xc, format: "ADDR", operation: "se N=1, PC ← addr", affectedFlags: [] },
  { mnemonic: "HLT", opcode: 0xf, format: "NONE", operation: "para a execução", affectedFlags: [] },
];

const SPEC_BY_MNEMONIC = new Map<string, InstructionSpec>(ISA.map((spec) => [spec.mnemonic, spec]));
const SPEC_BY_OPCODE = new Map<number, InstructionSpec>(ISA.map((spec) => [spec.opcode, spec]));

/** Busca a instrução pelo mnemônico, sem diferenciar maiúsculas de minúsculas. */
export function specForMnemonic(name: string): InstructionSpec | undefined {
  return SPEC_BY_MNEMONIC.get(name.toUpperCase());
}

/** Busca a instrução pelo opcode; `undefined` para opcodes reservados. */
export function specForOpcode(opcode: number): InstructionSpec | undefined {
  return SPEC_BY_OPCODE.get(opcode);
}

export function isWord(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= WORD_MASK;
}

function isRegisterIndex(value: number): value is RegisterIndex {
  return Number.isInteger(value) && value >= 0 && value <= 3;
}

/** Monta a palavra de 16 bits de uma instrução. */
export function encode(instruction: Instruction): Word {
  const spec = SPEC_BY_MNEMONIC.get(instruction.mnemonic);
  if (!spec) {
    throw new RangeError(`Mnemônico desconhecido: ${instruction.mnemonic}`);
  }
  if (!isRegisterIndex(instruction.rd) || !isRegisterIndex(instruction.rs)) {
    throw new RangeError(`Registrador fora de R0–R3 em ${instruction.mnemonic}`);
  }
  if (!Number.isInteger(instruction.operand) || instruction.operand < 0 || instruction.operand > OPERAND_MASK) {
    throw new RangeError(`Operando fora de 8 bits em ${instruction.mnemonic}: ${instruction.operand}`);
  }
  return (spec.opcode << 12) | (instruction.rd << 10) | (instruction.rs << 8) | instruction.operand;
}

/** Separa os campos de uma palavra, como a UC faz ao ler o IR. */
export function extractFields(word: Word): InstructionFields {
  if (!isWord(word)) {
    throw new RangeError(`Palavra fora de 16 bits: ${word}`);
  }
  return {
    opcode: (word >> 12) & 0xf,
    rd: ((word >> 10) & 0b11) as RegisterIndex,
    rs: ((word >> 8) & 0b11) as RegisterIndex,
    operand: word & OPERAND_MASK,
  };
}

export type DecodeResult =
  | { readonly valid: true; readonly fields: InstructionFields; readonly instruction: Instruction }
  | { readonly valid: false; readonly fields: InstructionFields; readonly error: string };

/**
 * Decodifica uma palavra. Opcodes reservados não lançam exceção: retornam
 * `valid: false` com a mensagem didática que a UI exibe.
 */
export function decode(word: Word): DecodeResult {
  const fields = extractFields(word);
  const spec = specForOpcode(fields.opcode);
  if (!spec) {
    return {
      valid: false,
      fields,
      error: `Instrução inválida: o opcode ${toHex(fields.opcode, 1)} é reservado.`,
    };
  }
  return {
    valid: true,
    fields,
    instruction: { mnemonic: spec.mnemonic, rd: fields.rd, rs: fields.rs, operand: fields.operand },
  };
}

/** Texto em assembly de uma instrução, ex.: "ADD R1, R2" ou "LOAD R0, [0xF0]". */
export function formatInstruction(instruction: Instruction): string {
  const { mnemonic, rd, rs, operand } = instruction;
  switch (SPEC_BY_MNEMONIC.get(mnemonic)?.format) {
    case "RD":
      return `${mnemonic} R${rd}`;
    case "RD_RS":
      return `${mnemonic} R${rd}, R${rs}`;
    case "RD_IMM":
      return `${mnemonic} R${rd}, ${operand}`;
    case "RD_ADDR":
      return `${mnemonic} R${rd}, [${toHex(operand, 2)}]`;
    case "ADDR":
      return `${mnemonic} ${toHex(operand, 2)}`;
    default:
      return mnemonic;
  }
}

/** Formata em hexadecimal, ex.: toHex(240, 2) → "0xF0". */
export function toHex(value: number, digits: number): string {
  return "0x" + value.toString(16).toUpperCase().padStart(digits, "0");
}
