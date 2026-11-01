import { describe, expect, it } from "vitest";
import {
  createMemory,
  IO_ADDRESS,
  IO_REGION_START,
  isIoAddress,
  isValidAddress,
  MEMORY_SIZE,
  readWord,
  writeWord,
} from "@/core/memory";

describe("memória principal", () => {
  it("tem 256 palavras zeradas por padrão", () => {
    const memory = createMemory();
    expect(memory).toHaveLength(MEMORY_SIZE);
    expect(memory.every((word) => word === 0)).toBe(true);
  });

  it("carrega a imagem do programa a partir de 0x00", () => {
    const memory = createMemory([0x3405, 0x5600, 0xf000]);
    expect(memory.slice(0, 4)).toEqual([0x3405, 0x5600, 0xf000, 0]);
  });

  it("aceita um programa que ocupa toda a área 0x00–0xEF", () => {
    expect(createMemory(new Array(IO_REGION_START).fill(1))[0xef]).toBe(1);
  });

  it("rejeita programa que invade a região de E/S", () => {
    expect(() => createMemory(new Array(IO_REGION_START + 1).fill(0))).toThrow(/região de E\/S/);
  });

  it("rejeita palavras fora de 16 bits na imagem", () => {
    expect(() => createMemory([0x10000])).toThrow(RangeError);
    expect(() => createMemory([0, -1])).toThrow(/0x01/);
  });

  it("lê e escreve sem alterar o estado anterior (imutável)", () => {
    const before = createMemory([1, 2, 3]);
    const after = writeWord(before, 0x01, 0xbeef);
    expect(readWord(after, 0x01)).toBe(0xbeef);
    expect(readWord(before, 0x01)).toBe(2);
    expect(after).not.toBe(before);
  });

  it("acessa todo o espaço de endereços, inclusive a região de E/S", () => {
    const memory = writeWord(createMemory(), 0xff, 42);
    expect(readWord(memory, 0xff)).toBe(42);
  });

  it("rejeita endereços e valores inválidos", () => {
    const memory = createMemory();
    expect(() => readWord(memory, 256)).toThrow(RangeError);
    expect(() => readWord(memory, -1)).toThrow(RangeError);
    expect(() => writeWord(memory, 0.5, 0)).toThrow(RangeError);
    expect(() => writeWord(memory, 0, 0x10000)).toThrow(RangeError);
  });
});

describe("mapa de E/S", () => {
  it("fixa os endereços dos dispositivos (§4.2)", () => {
    expect(IO_ADDRESS).toEqual({ KEYBOARD: 0xf0, DISPLAY: 0xf1, LED: 0xf2 });
  });

  it("identifica a região 0xF0–0xFF", () => {
    expect(isIoAddress(0xef)).toBe(false);
    expect(isIoAddress(0xf0)).toBe(true);
    expect(isIoAddress(0xff)).toBe(true);
    expect(isIoAddress(0x100)).toBe(false);
  });

  it("valida endereços de 8 bits", () => {
    expect(isValidAddress(0)).toBe(true);
    expect(isValidAddress(255)).toBe(true);
    expect(isValidAddress(256)).toBe(false);
    expect(isValidAddress(1.5)).toBe(false);
  });
});
