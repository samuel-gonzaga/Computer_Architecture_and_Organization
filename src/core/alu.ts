// Unidade Lógica e Aritmética (ULA) de 16 bits.

import { WORD_MASK } from "./isa";
import type { AluOp, Flags, Word } from "./types";

const SIGN_BIT = 0x8000;

export type AluResult = {
  readonly result: Word;
  readonly flags: Flags;
};

/**
 * Executa uma operação da ULA sobre duas palavras de 16 bits.
 * - ADD e SUB atualizam Z, N, C e V.
 * - AND, OR e NOT atualizam Z e N; C e V são preservados de `flags`.
 * - Em NOT, o operando `b` é ignorado.
 */
export function aluExecute(op: AluOp, a: Word, b: Word, flags: Flags): AluResult {
  switch (op) {
    case "ADD": {
      const sum = a + b;
      const result = sum & WORD_MASK;
      return {
        result,
        flags: {
          ...zeroAndNegative(result),
          C: sum > WORD_MASK, // vai-um para fora do bit 15
          V: ((a ^ result) & (b ^ result) & SIGN_BIT) !== 0, // operandos de mesmo sinal, resultado de sinal oposto
        },
      };
    }
    case "SUB": {
      const result = (a - b) & WORD_MASK;
      return {
        result,
        flags: {
          ...zeroAndNegative(result),
          C: a < b, // empresta-um (borrow): a < b sem sinal
          V: ((a ^ b) & (a ^ result) & SIGN_BIT) !== 0, // operandos de sinais opostos, resultado com o sinal de b
        },
      };
    }
    case "AND":
      return logical(a & b, flags);
    case "OR":
      return logical(a | b, flags);
    case "NOT":
      return logical(~a & WORD_MASK, flags);
  }
}

/** Interpreta a palavra em complemento de dois, ex.: 0xFFFF → -1. */
export function toSigned16(word: Word): number {
  return word & SIGN_BIT ? word - 0x10000 : word;
}

function zeroAndNegative(result: Word): Pick<Flags, "Z" | "N"> {
  return { Z: result === 0, N: (result & SIGN_BIT) !== 0 };
}

function logical(result: Word, flags: Flags): AluResult {
  return { result, flags: { ...flags, ...zeroAndNegative(result) } };
}
