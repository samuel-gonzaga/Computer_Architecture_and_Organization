import { describe, expect, it } from "vitest";
import {
  CACHE_LINES,
  cacheStatistics,
  createCache,
  fill,
  lookup,
  recordHit,
  recordMiss,
  splitAddress,
  writeThrough,
} from "@/core/cache";
import { createMachine, step } from "@/core/machine";
import { executeMicros, runSource, splitByInstruction } from "./helpers";

describe("cache — unidade", () => {
  it("começa com 8 linhas inválidas e contadores zerados", () => {
    const cache = createCache();
    expect(cache.lines).toHaveLength(CACHE_LINES);
    expect(cache.lines.every((line) => !line.valid)).toBe(true);
    expect(cache).toMatchObject({ hits: 0, misses: 0 });
  });

  it("divide o endereço em tag (5 bits) e índice (3 bits)", () => {
    expect(splitAddress(0x00)).toEqual({ tag: 0x00, index: 0 });
    expect(splitAddress(0x05)).toEqual({ tag: 0x00, index: 5 });
    expect(splitAddress(0x20)).toEqual({ tag: 0x04, index: 0 });
    expect(splitAddress(0b10110_011)).toEqual({ tag: 0b10110, index: 0b011 });
    expect(splitAddress(0xff)).toEqual({ tag: 0x1f, index: 7 });
  });

  it("MISS na cache vazia; HIT depois de preencher a linha", () => {
    let cache = createCache();
    expect(lookup(cache, 0x0d).hit).toBe(false);
    cache = fill(cache, 0x0d, 0xabcd);
    expect(cache.lines[5]).toEqual({ valid: true, tag: 0x01, data: 0xabcd, lastEvent: "MISS" });
    expect(lookup(cache, 0x0d)).toMatchObject({ hit: true, tag: 0x01, index: 5 });
  });

  it("conflito: mesmo índice com outra tag é MISS e o preenchimento substitui a linha", () => {
    let cache = fill(createCache(), 0x02, 111); // índice 2, tag 0
    expect(lookup(cache, 0x0a)).toMatchObject({ hit: false, index: 2, tag: 1 }); // índice 2, tag 1
    cache = fill(cache, 0x0a, 222);
    expect(lookup(cache, 0x02).hit).toBe(false);
    expect(lookup(cache, 0x0a).line.data).toBe(222);
  });

  it("registra HIT e MISS nos contadores e no último evento da linha", () => {
    const cache = recordMiss(recordHit(fill(createCache(), 0x03, 1), 3));
    expect(cache).toMatchObject({ hits: 1, misses: 1 });
    expect(cache.lines[3].lastEvent).toBe("HIT");
  });

  it("write-through atualiza a linha só se o endereço estiver na cache", () => {
    const cache = fill(createCache(), 0x04, 1);
    const present = writeThrough(cache, 0x04, 99);
    expect(present.updated).toBe(true);
    expect(present.cache.lines[4]).toEqual({ valid: true, tag: 0, data: 99, lastEvent: "WRITE" });

    const absent = writeThrough(cache, 0x0c, 99); // mesmo índice, outra tag
    expect(absent).toEqual({ cache, updated: false }); // no-write-allocate
  });

  it("não altera a cache recebida (imutabilidade)", () => {
    const cache = createCache();
    fill(cache, 0x01, 5);
    recordHit(cache, 1);
    expect(cache).toEqual(createCache());
  });

  it("calcula taxa de acerto e ciclos economizados", () => {
    const cache = { ...createCache(), hits: 3, misses: 1 };
    expect(cacheStatistics(cache, 100)).toEqual({
      hits: 3,
      misses: 1,
      hitRate: 0.75,
      totalCycles: 100,
      savedCycles: 12, // 3 HITs × 4 ciclos de espera
      cyclesWithoutCache: 112,
    });
    expect(cacheStatistics(createCache(), 0).hitRate).toBe(0);
  });
});

describe("cache — integrada à máquina", () => {
  it("HIT custa 1 ciclo; MISS custa 1 + 4 ciclos de espera", () => {
    const { micros } = runSource("LOAD R0, [0x10]\nLOAD R1, [0x10]\nHLT");
    const [first, second] = [executeMicros(micros, 0)[1], executeMicros(micros, 1)[1]];
    expect(first).toMatchObject({ cache: { type: "MISS", index: 0, tag: 2 }, waitCycles: 4 });
    expect(second).toMatchObject({ cache: { type: "HIT", index: 0, tag: 2 } });
    expect(second.waitCycles).toBeUndefined();
    const previousCycle = (micro: (typeof micros)[number]) => micros[micros.indexOf(micro) - 1].cycle;
    expect(first.cycle - previousCycle(first)).toBe(5);
    expect(second.cycle - previousCycle(second)).toBe(1);
  });

  it("explica HIT, MISS por linha vazia e MISS por conflito", () => {
    // 0x0B e 0x13 disputam a linha 3 (tags 0x01 e 0x02).
    const { micros } = runSource("LOAD R0, [0x0B]\nLOAD R1, [0x0B]\nLOAD R2, [0x13]\nHLT");
    expect(executeMicros(micros, 0)[1].explanation).toBe(
      "A UC ativa MEM_READ e consulta a cache: o endereço 0x0B tem tag 0x01 e índice 3. " +
        "A linha 3 está vazia (bit de validade = 0): MISS. " +
        "O dado precisa vir da RAM, e a CPU aguarda 4 ciclos de espera (wait states).",
    );
    expect(executeMicros(micros, 0)[2].explanation).toBe(
      "A RAM coloca a palavra 0x0000 no barramento de dados. A cache guarda uma cópia na linha 3 (tag 0x01) e o MDR armazena a palavra.",
    );
    expect(executeMicros(micros, 1)[1].explanation).toContain("A linha 3 é válida e guarda essa tag: HIT!");
    expect(executeMicros(micros, 1)[2]).toMatchObject({ activeComponents: ["CACHE", "MDR"] });
    expect(executeMicros(micros, 1)[2].explanation).toBe("A cache coloca a palavra 0x0000 no barramento de dados e o MDR a armazena.");
    expect(executeMicros(micros, 2)[1].explanation).toContain("A linha 3 guarda a tag 0x01, de outro endereço: MISS.");
  });

  it("guarda instruções e dados na mesma cache (unificada)", () => {
    const { state } = runSource("LOAD R0, [dado]\nHLT\ndado: .word 77");
    expect(state.cache.lines.slice(0, 3)).toEqual([
      { valid: true, tag: 0, data: 0x1002, lastEvent: "MISS" }, // instrução LOAD
      { valid: true, tag: 0, data: 0xf000, lastEvent: "MISS" }, // instrução HLT
      { valid: true, tag: 0, data: 77, lastEvent: "MISS" }, // dado
    ]);
    expect(state.cache).toMatchObject({ hits: 0, misses: 3 });
  });

  it("write-through: STORE em endereço presente atualiza cache e RAM", () => {
    const { state, micros } = runSource("LDI R1, 9\nLOAD R0, [0x30]\nSTORE R1, [0x30]\nLOAD R2, [0x30]\nHLT");
    const write = executeMicros(micros, 2)[1];
    expect(write.cache).toEqual({ type: "WRITE", index: 0, tag: 6 });
    expect(write.explanation).toContain("também é atualizada (write-through)");
    expect(executeMicros(micros, 3)[1].cache?.type).toBe("HIT"); // o dado novo já está na cache
    expect(state.registers[2]).toBe(9);
    expect(state.memory[0x30]).toBe(9);
    expect(state.cache.lines[0]).toMatchObject({ valid: true, tag: 6, data: 9 });
  });

  it("no-write-allocate: STORE em endereço ausente não traz o endereço para a cache", () => {
    const { state, micros } = runSource("LDI R1, 9\nSTORE R1, [0x30]\nLOAD R2, [0x30]\nHLT");
    expect(executeMicros(micros, 1)[1].explanation).toContain("não está na cache, que não é alterada (no-write-allocate)");
    expect(executeMicros(micros, 2)[1].cache?.type).toBe("MISS");
    expect(state.registers[2]).toBe(9);
  });

  it("BYPASS: a região de E/S não passa pela cache", () => {
    const { state, micros } = runSource("LOAD R0, [0xF0]\nSTORE R0, [0xF1]\nHLT", 5);
    const read = executeMicros(micros, 0)[1];
    const write = executeMicros(micros, 1)[1];
    expect(read.cache).toEqual({ type: "BYPASS", index: 0, tag: 0x1e });
    expect(write.cache).toEqual({ type: "BYPASS", index: 1, tag: 0x1e });
    expect(read.activeComponents).not.toContain("CACHE");
    expect(read.explanation).toContain("a cache é ignorada (BYPASS)");
    expect(write.explanation).toContain("a cache é ignorada (BYPASS)");
    // Só as 3 buscas de instrução passaram pela cache.
    expect(state.cache).toMatchObject({ hits: 0, misses: 3 });
    expect(state.cache.lines.filter((line) => line.valid)).toHaveLength(3);
  });

  it("reset esvazia a cache", () => {
    let state = createMachine([0xf000]);
    for (let i = 0; i < 4; i++) {
      state = step(state).state;
    }
    expect(state.cache.misses).toBe(1);
    expect(createMachine(state.disk).cache).toEqual(createCache());
  });

  it("instruções de um laço viram HIT a partir da 2ª volta", () => {
    const { micros } = runSource("LDI R0, 3\nLDI R1, 1\nloop: SUB R0, R1\nJZ fim\nJMP loop\nfim: HLT");
    const fetchResults = splitByInstruction(micros).map((group) => [group[4].instruction, group[1].cache?.type]);
    expect(fetchResults).toEqual([
      ["LDI R0, 3", "MISS"],
      ["LDI R1, 1", "MISS"],
      ["SUB R0, R1", "MISS"], // 1ª volta
      ["JZ 0x05", "MISS"],
      ["JMP 0x02", "MISS"],
      ["SUB R0, R1", "HIT"], // 2ª volta
      ["JZ 0x05", "HIT"],
      ["JMP 0x02", "HIT"],
      ["SUB R0, R1", "HIT"], // 3ª volta
      ["JZ 0x05", "HIT"],
      ["HLT", "MISS"],
    ]);
  });
});
