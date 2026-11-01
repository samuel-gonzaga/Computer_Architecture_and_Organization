import { describe, expect, it } from "vitest";
import { createIo, deviceAt, IO_DEVICES, readIo, setKeyboard, writeIo } from "@/core/io";

describe("dispositivos de E/S", () => {
  it("liga teclado, display e LED aos endereços 0xF0–0xF2", () => {
    expect(IO_DEVICES.map((device) => [device.address, device.component, device.direction])).toEqual([
      [0xf0, "KEYBOARD", "input"],
      [0xf1, "DISPLAY", "output"],
      [0xf2, "LED", "output"],
    ]);
    expect(deviceAt(0xf1)?.name).toBe("display");
    expect(deviceAt(0xf5)).toBeUndefined();
  });

  it("começa zerado, com a entrada do teclado opcional", () => {
    expect(createIo()).toEqual({ keyboard: 0, display: 0, led: 0 });
    expect(createIo(5)).toEqual({ keyboard: 5, display: 0, led: 0 });
  });

  it("lê o valor de cada dispositivo; endereço sem dispositivo lê 0", () => {
    const io = { keyboard: 5, display: 12, led: 1 };
    expect(readIo(io, 0xf0)).toBe(5);
    expect(readIo(io, 0xf1)).toBe(12);
    expect(readIo(io, 0xf2)).toBe(1);
    expect(readIo(io, 0xf9)).toBe(0);
  });

  it("escreve no display e no LED; teclado e endereços vazios ignoram a escrita", () => {
    const io = createIo(5);
    expect(writeIo(io, 0xf1, 12)).toEqual({ keyboard: 5, display: 12, led: 0 });
    expect(writeIo(io, 0xf2, 1)).toEqual({ keyboard: 5, display: 0, led: 1 });
    expect(writeIo(io, 0xf0, 99)).toBe(io);
    expect(writeIo(io, 0xff, 99)).toBe(io);
  });

  it("valida a entrada do teclado (16 bits)", () => {
    expect(setKeyboard(createIo(), 0xffff).keyboard).toBe(0xffff);
    expect(() => setKeyboard(createIo(), 0x10000)).toThrow(RangeError);
    expect(() => createIo(-1)).toThrow(RangeError);
  });
});
