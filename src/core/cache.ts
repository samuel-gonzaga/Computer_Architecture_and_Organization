// Cache L1 de mapeamento direto (§4.5).
//
// - 8 linhas de 1 palavra; unificada (instruções e dados), como em Von Neumann.
// - Endereço de 8 bits = tag (5 bits) | índice (3 bits): o índice escolhe a
//   linha e a tag diz qual dos 32 endereços possíveis ela guarda.
// - Escrita write-through (a RAM é sempre escrita) e no-write-allocate (uma
//   escrita não traz o endereço para a cache).
// - A região de E/S (0xF0–0xFF) não é cacheável; a máquina faz o bypass.

import { RAM_WAIT_CYCLES } from "./memory";
import type { Address, CacheLine, CacheState, Word } from "./types";

export const CACHE_LINES = 8;
const INDEX_BITS = 3;
const INDEX_MASK = CACHE_LINES - 1;

export function createCache(): CacheState {
  return {
    lines: Array.from({ length: CACHE_LINES }, () => ({ valid: false, tag: 0, data: 0 })),
    hits: 0,
    misses: 0,
  };
}

/** Divide o endereço em tag e índice, ex.: 0x20 → tag 0x04, índice 0. */
export function splitAddress(address: Address): { tag: number; index: number } {
  return { tag: address >> INDEX_BITS, index: address & INDEX_MASK };
}

/** Consulta a cache sem alterá-la: HIT se a linha do índice é válida e guarda a mesma tag. */
export function lookup(cache: CacheState, address: Address): { hit: boolean; tag: number; index: number; line: CacheLine } {
  const { tag, index } = splitAddress(address);
  const line = cache.lines[index];
  return { hit: line.valid && line.tag === tag, tag, index, line };
}

export function recordHit(cache: CacheState, index: number): CacheState {
  return { ...replaceLine(cache, index, { ...cache.lines[index], lastEvent: "HIT" }), hits: cache.hits + 1 };
}

export function recordMiss(cache: CacheState): CacheState {
  return { ...cache, misses: cache.misses + 1 };
}

/** Após um MISS, guarda na linha a palavra que veio da RAM (substituindo o conteúdo anterior). */
export function fill(cache: CacheState, address: Address, data: Word): CacheState {
  const { tag, index } = splitAddress(address);
  return replaceLine(cache, index, { valid: true, tag, data, lastEvent: "MISS" });
}

/**
 * Write-through com no-write-allocate: se o endereço está na cache, a linha é
 * atualizada junto com a RAM; se não está, a cache não muda.
 */
export function writeThrough(cache: CacheState, address: Address, data: Word): { cache: CacheState; updated: boolean } {
  const { hit, index, line } = lookup(cache, address);
  if (!hit) {
    return { cache, updated: false };
  }
  return { cache: replaceLine(cache, index, { ...line, data, lastEvent: "WRITE" }), updated: true };
}

export type CacheStatistics = {
  readonly hits: number;
  readonly misses: number;
  readonly hitRate: number; // 0–1; leituras atendidas pela cache
  readonly totalCycles: number;
  readonly savedCycles: number; // ciclos de espera evitados pelos HITs
  readonly cyclesWithoutCache: number; // quanto a mesma execução custaria sem cache
};

/** Estatísticas da cache. Cada HIT evita os ciclos de espera de um acesso à RAM. */
export function cacheStatistics(cache: CacheState, totalCycles: number): CacheStatistics {
  const reads = cache.hits + cache.misses;
  const savedCycles = cache.hits * RAM_WAIT_CYCLES;
  return {
    hits: cache.hits,
    misses: cache.misses,
    hitRate: reads === 0 ? 0 : cache.hits / reads,
    totalCycles,
    savedCycles,
    cyclesWithoutCache: totalCycles + savedCycles,
  };
}

function replaceLine(cache: CacheState, index: number, line: CacheLine): CacheState {
  const lines = cache.lines.slice();
  lines[index] = line;
  return { ...cache, lines };
}
