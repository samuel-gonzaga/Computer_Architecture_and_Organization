// Arquivo de simulação ".neocore.json" (R13): guarda o programa para abrir de novo depois.

import { isWord } from "@/core/isa";

export const PROGRAM_FILE_FORMAT = "neocore-lab/programa";
export const PROGRAM_FILE_VERSION = 1;
export const PROGRAM_FILE_EXTENSION = ".neocore.json";

export type ProgramFile = {
  readonly format: typeof PROGRAM_FILE_FORMAT;
  readonly version: typeof PROGRAM_FILE_VERSION;
  readonly name: string;
  readonly source: string; // código assembly
  readonly keyboard: number; // entrada do teclado (0xF0)
};

export function serializeProgram({ name, source, keyboard }: Pick<ProgramFile, "name" | "source" | "keyboard">): string {
  const file: ProgramFile = { format: PROGRAM_FILE_FORMAT, version: PROGRAM_FILE_VERSION, name, source, keyboard };
  return JSON.stringify(file, null, 2) + "\n";
}

export type ParseResult = { readonly ok: true; readonly file: ProgramFile } | { readonly ok: false; readonly error: string };

/** Lê e valida um arquivo .neocore.json. Nunca lança exceção: devolve a mensagem de erro. */
export function parseProgramFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  if (typeof data !== "object" || data === null || (data as { format?: unknown }).format !== PROGRAM_FILE_FORMAT) {
    return { ok: false, error: "O arquivo não é um programa do NeoCore Computer Lab." };
  }
  const { version, name, source, keyboard } = data as Record<string, unknown>;
  if (version !== PROGRAM_FILE_VERSION) {
    return { ok: false, error: `Versão de arquivo não suportada: ${String(version)}.` };
  }
  if (typeof source !== "string") {
    return { ok: false, error: "O arquivo não contém o código do programa." };
  }
  if (keyboard !== undefined && (typeof keyboard !== "number" || !isWord(keyboard))) {
    return { ok: false, error: "A entrada do teclado no arquivo deve ser um número de 0 a 65535." };
  }
  return {
    ok: true,
    file: {
      format: PROGRAM_FILE_FORMAT,
      version: PROGRAM_FILE_VERSION,
      name: typeof name === "string" && name.trim() ? name.trim() : "Programa importado",
      source,
      keyboard: keyboard ?? 0,
    },
  };
}

/** Nome de arquivo a partir do nome do programa, ex.: "Soma simples" → "soma-simples.neocore.json". */
export function programFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "programa"}${PROGRAM_FILE_EXTENSION}`;
}
