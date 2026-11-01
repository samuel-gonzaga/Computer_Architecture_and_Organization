// Montador (assembler): texto em assembly → palavras de 16 bits (§6.4).
//
// Sintaxe:
//   - um comando por linha; ";" inicia um comentário;
//   - rótulos no início da linha ("loop:"), opcionalmente seguidos de uma instrução;
//   - diretivas ".org endereço" e ".word valor";
//   - números em decimal ou hexadecimal ("0x"); rótulos valem como endereço.
//
// A montagem é feita em duas passagens: a 1ª calcula o endereço de cada linha e
// registra os rótulos; a 2ª resolve os operandos e gera o código de máquina.
// Todos os erros são coletados; se houver algum, o programa não é carregado.

import { encode, OPERAND_MASK, specForMnemonic, toHex, WORD_MASK, type InstructionSpec, type OperandFormat } from "./isa";
import { IO_REGION_START } from "./memory";
import type { Address, RegisterIndex, Word } from "./types";

export type AssemblerError = {
  readonly line: number;
  readonly message: string; // ex.: "Linha 3: registrador inválido 'R5'"
};

/** Uma linha do código-fonte com o endereço e o código de máquina que ela gerou. */
export type ListingLine = {
  readonly line: number;
  readonly source: string;
  readonly address?: Address;
  readonly word?: Word;
  readonly kind?: "instruction" | "data"; // presente quando a linha gerou uma palavra
};

export type AssembleResult =
  | { readonly ok: true; readonly program: Word[]; readonly listing: ListingLine[] }
  | { readonly ok: false; readonly errors: AssemblerError[] };

type OperandKind = "rd" | "rs" | "imm" | "addr" | "mem";

const OPERAND_KINDS: Record<OperandFormat, OperandKind[]> = {
  NONE: [],
  RD: ["rd"],
  RD_RS: ["rd", "rs"],
  RD_IMM: ["rd", "imm"],
  RD_ADDR: ["rd", "mem"],
  ADDR: ["addr"],
};

const OPERAND_LABEL: Record<OperandKind, string> = {
  rd: "rd",
  rs: "rs",
  imm: "imm",
  addr: "addr",
  mem: "[addr]",
};

const LABEL_DEFINITION = /^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/;
const LABEL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER = /^-?(0x[0-9a-f]+|\d+)$/i;
const REGISTER = /^R([0-3])$/i;
const MEMORY_OPERAND = /^\[\s*(.*?)\s*\]$/;

/** Linha que ocupa uma palavra na memória: uma instrução ou um ".word". */
type Statement = {
  readonly line: number;
  readonly address: Address;
  readonly operands: string[];
  readonly spec?: InstructionSpec; // ausente em ".word"
};

type Context = {
  readonly labels: Map<string, { address: Address; line: number }>;
  readonly report: (line: number, message: string) => void;
};

export function assemble(source: string): AssembleResult {
  const lines = source.split(/\r?\n/);
  const errors: AssemblerError[] = [];
  const ctx: Context = {
    labels: new Map(),
    report: (line, message) => errors.push({ line, message: `Linha ${line}: ${message}` }),
  };

  const statements = firstPass(lines, ctx);
  const words = new Map<number, { address: Address; word: Word; kind: "instruction" | "data" }>(); // linha → código gerado
  for (const statement of statements) {
    const word = statement.spec
      ? assembleInstruction(statement, statement.spec, ctx)
      : assembleWordDirective(statement, ctx);
    if (word !== undefined) {
      words.set(statement.line, { address: statement.address, word, kind: statement.spec ? "instruction" : "data" });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors.sort((a, b) => a.line - b.line) };
  }

  // Imagem do programa a partir de 0x00; lacunas deixadas por ".org" ficam com 0 (NOP).
  const size = Math.max(0, ...statements.map((s) => s.address + 1));
  const program = new Array<Word>(size).fill(0);
  for (const { address, word } of words.values()) {
    program[address] = word;
  }
  const listing = lines.map((text, index) => ({ line: index + 1, source: text, ...words.get(index + 1) }));
  return { ok: true, program, listing };
}

// ---------------------------------------------------------------------------
// 1ª passagem: endereços e rótulos

function firstPass(lines: string[], ctx: Context): Statement[] {
  const statements: Statement[] = [];
  const occupiedBy = new Map<Address, number>(); // endereço → linha que o ocupou
  let address = 0;

  const emit = (line: number, operands: string[], spec?: InstructionSpec) => {
    if (address >= IO_REGION_START) {
      ctx.report(line, `o programa invade a região de E/S (${toHex(IO_REGION_START, 2)}–0xFF)`);
      return;
    }
    const previous = occupiedBy.get(address);
    if (previous !== undefined) {
      ctx.report(line, `o endereço ${toHex(address, 2)} já foi ocupado pela linha ${previous}`);
    } else {
      occupiedBy.set(address, line);
    }
    statements.push({ line, address, operands, spec });
    address += 1;
  };

  lines.forEach((raw, index) => {
    const line = index + 1;
    let text = stripComment(raw);

    const label = LABEL_DEFINITION.exec(text);
    if (label) {
      const name = label[1];
      const existing = ctx.labels.get(name);
      if (existing) {
        ctx.report(line, `rótulo '${name}' já definido na linha ${existing.line}`);
      } else {
        ctx.labels.set(name, { address, line });
      }
      text = label[2].trim();
    }
    if (text === "") {
      return;
    }

    const { name, operands } = splitStatement(text);
    if (name.startsWith(".")) {
      switch (name.toLowerCase()) {
        case ".org": {
          const target = parseOrg(operands, line, ctx);
          if (target !== undefined) {
            address = target;
          }
          return;
        }
        case ".word":
          emit(line, operands);
          return;
        default:
          ctx.report(line, `diretiva desconhecida '${name}'`);
          return;
      }
    }

    const spec = specForMnemonic(name);
    if (!spec) {
      ctx.report(line, `instrução desconhecida '${name}'`);
      return;
    }
    emit(line, operands, spec);
  });

  return statements;
}

function parseOrg(operands: string[], line: number, ctx: Context): Address | undefined {
  if (operands.length !== 1) {
    ctx.report(line, `'.org' espera 1 operando (endereço), mas recebeu ${operands.length}`);
    return undefined;
  }
  const value = parseNumber(operands[0]);
  if (value === undefined) {
    ctx.report(line, `'.org' espera um endereço numérico, mas recebeu '${operands[0]}'`);
    return undefined;
  }
  if (value < 0 || value >= IO_REGION_START) {
    ctx.report(line, `'.org' fora da área de programa (0x00–${toHex(IO_REGION_START - 1, 2)}): ${operands[0]}`);
    return undefined;
  }
  return value;
}

// ---------------------------------------------------------------------------
// 2ª passagem: operandos e código de máquina

function assembleInstruction(statement: Statement, spec: InstructionSpec, ctx: Context): Word | undefined {
  const { line, operands } = statement;
  const kinds = OPERAND_KINDS[spec.format];
  if (operands.length !== kinds.length) {
    ctx.report(line, operandCountMessage(spec.mnemonic, kinds, operands.length));
    return undefined;
  }

  const fields = { rd: 0 as RegisterIndex, rs: 0 as RegisterIndex, operand: 0 };
  let valid = true;
  kinds.forEach((kind, i) => {
    if (kind === "rd" || kind === "rs") {
      const register = parseRegister(operands[i]);
      if (register === undefined) {
        ctx.report(line, `registrador inválido '${operands[i]}'`);
        valid = false;
      } else {
        fields[kind] = register;
      }
      return;
    }
    const value = parseByteOperand(kind, operands[i], line, ctx);
    if (value === undefined) {
      valid = false;
    } else {
      fields.operand = value;
    }
  });

  return valid ? encode({ mnemonic: spec.mnemonic, ...fields }) : undefined;
}

function assembleWordDirective(statement: Statement, ctx: Context): Word | undefined {
  const { line, operands } = statement;
  if (operands.length !== 1) {
    ctx.report(line, `'.word' espera 1 operando (valor), mas recebeu ${operands.length}`);
    return undefined;
  }
  const value = resolveValue(operands[0], line, ctx);
  if (value === undefined) {
    return undefined;
  }
  // Aceita sem sinal (0…65535) ou com sinal (−32768…−1, gravado em complemento de dois).
  if (value < -0x8000 || value > WORD_MASK) {
    ctx.report(line, `valor fora do intervalo de 16 bits: ${operands[0]}`);
    return undefined;
  }
  return value & WORD_MASK;
}

/** Operando de 8 bits: imediato (LDI), endereço (JMP/JZ/JN) ou endereço entre colchetes (LOAD/STORE). */
function parseByteOperand(kind: "imm" | "addr" | "mem", text: string, line: number, ctx: Context): number | undefined {
  let valueText = text;
  if (kind === "mem") {
    const match = MEMORY_OPERAND.exec(text);
    if (!match) {
      ctx.report(line, `endereço de memória deve estar entre colchetes, ex.: [0x20] (recebeu '${text}')`);
      return undefined;
    }
    valueText = match[1];
  }

  const value = resolveValue(valueText, line, ctx);
  if (value === undefined) {
    return undefined;
  }
  if (value < 0 || value > OPERAND_MASK) {
    ctx.report(
      line,
      kind === "imm"
        ? `imediato fora do intervalo 0–255: ${valueText}`
        : `endereço fora do intervalo 0x00–0xFF: ${valueText}`,
    );
    return undefined;
  }
  return value;
}

/** Número literal ou rótulo (que vale o seu endereço). */
function resolveValue(text: string, line: number, ctx: Context): number | undefined {
  const number = parseNumber(text);
  if (number !== undefined) {
    return number;
  }
  if (LABEL_NAME.test(text)) {
    const label = ctx.labels.get(text);
    if (!label) {
      ctx.report(line, `rótulo não definido '${text}'`);
      return undefined;
    }
    return label.address;
  }
  ctx.report(line, `valor inválido '${text}'`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Utilitários de texto

function stripComment(raw: string): string {
  const start = raw.indexOf(";");
  return (start === -1 ? raw : raw.slice(0, start)).trim();
}

/** Separa "LOAD R0, [0x20]" em nome ("LOAD") e operandos (["R0", "[0x20]"]). */
function splitStatement(text: string): { name: string; operands: string[] } {
  const space = text.search(/\s/);
  if (space === -1) {
    return { name: text, operands: [] };
  }
  return {
    name: text.slice(0, space),
    operands: text.slice(space).split(",").map((operand) => operand.trim()),
  };
}

function parseNumber(text: string): number | undefined {
  if (!NUMBER.test(text)) {
    return undefined;
  }
  return text.startsWith("-") ? -Number(text.slice(1)) : Number(text);
}

function parseRegister(text: string): RegisterIndex | undefined {
  const match = REGISTER.exec(text);
  return match ? (Number(match[1]) as RegisterIndex) : undefined;
}

function operandCountMessage(mnemonic: string, kinds: OperandKind[], received: number): string {
  if (kinds.length === 0) {
    return `'${mnemonic}' não recebe operandos, mas recebeu ${received}`;
  }
  const noun = kinds.length === 1 ? "operando" : "operandos";
  const signature = kinds.map((kind) => OPERAND_LABEL[kind]).join(", ");
  return `'${mnemonic}' espera ${kinds.length} ${noun} (${signature}), mas recebeu ${received}`;
}
