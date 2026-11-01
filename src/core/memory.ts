// Memória principal: 256 palavras de 16 bits, endereçadas por palavra (§4.2).
// Os endereços 0xF0–0xFF formam a região de E/S mapeada em memória.

import { isWord, toHex } from "./isa";
import type { Address, Word } from "./types";

export const MEMORY_SIZE = 256;

/** Ciclos de espera (wait states) de cada acesso à RAM (§4.5). */
export const RAM_WAIT_CYCLES = 4;

/** Primeiro endereço da região de E/S. Programas ocupam apenas 0x00–0xEF. */
export const IO_REGION_START = 0xf0;

/** Endereços dos dispositivos de E/S. */
export const IO_ADDRESS = {
  KEYBOARD: 0xf0, // entrada
  DISPLAY: 0xf1, // saída
  LED: 0xf2, // LED/status
} as const;

/** Memória imutável: escrever devolve uma nova cópia. */
export type Memory = readonly Word[];

export function isValidAddress(address: number): boolean {
  return Number.isInteger(address) && address >= 0 && address < MEMORY_SIZE;
}

export function isIoAddress(address: Address): boolean {
  return isValidAddress(address) && address >= IO_REGION_START;
}

/** Cria a RAM zerada e copia a imagem do programa a partir do endereço 0x00. */
export function createMemory(image: readonly Word[] = []): Memory {
  if (image.length > IO_REGION_START) {
    throw new RangeError(
      `O programa (${image.length} palavras) invade a região de E/S, que começa em ${toHex(IO_REGION_START, 2)}.`,
    );
  }
  const memory = new Array<Word>(MEMORY_SIZE).fill(0);
  image.forEach((word, address) => {
    assertWord(word, address);
    memory[address] = word;
  });
  return memory;
}

export function readWord(memory: Memory, address: Address): Word {
  assertAddress(address);
  return memory[address];
}

export function writeWord(memory: Memory, address: Address, value: Word): Memory {
  assertAddress(address);
  assertWord(value, address);
  const next = memory.slice();
  next[address] = value;
  return next;
}

function assertAddress(address: number): void {
  if (!isValidAddress(address)) {
    throw new RangeError(`Endereço fora de 0x00–0xFF: ${address}`);
  }
}

function assertWord(value: number, address: Address): void {
  if (!isWord(value)) {
    throw new RangeError(`Valor fora de 16 bits no endereço ${toHex(address, 2)}: ${value}`);
  }
}
