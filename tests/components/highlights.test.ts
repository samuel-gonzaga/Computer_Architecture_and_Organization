import { describe, expect, it } from "vitest";
import { highlightsFor } from "@/components/diagram/highlights";
import type { MicroStep } from "@/core/types";

function micro(overrides: Partial<MicroStep>): MicroStep {
  return {
    cycle: 1,
    phase: "EXECUTE",
    title: "teste",
    explanation: "teste",
    activeComponents: [],
    buses: { control: ["CLOCK"] },
    changes: [],
    ...overrides,
  };
}

describe("highlightsFor", () => {
  it("sem microetapa, nada acende", () => {
    const h = highlightsFor(undefined);
    expect(h.components.size).toBe(0);
    expect([h.address.active, h.data.active, h.control.active]).toEqual([false, false, false]);
    expect(h.clock).toBe(false);
  });

  it("acende exatamente os componentes ativos e marca os valores alterados", () => {
    const h = highlightsFor(
      micro({ activeComponents: ["ALU", "R1"], changes: [{ target: "R1", from: 5, to: 8 }] }),
    );
    expect([...h.components]).toEqual(["ALU", "R1"]);
    expect([...h.changed]).toEqual(["R1"]);
  });

  it("separa sinais internos da CPU, sinais do sistema e o clock", () => {
    const h = highlightsFor(micro({ buses: { control: ["CLOCK", "IR_LOAD", "PC_INC"] } }));
    expect(h.internalSignals).toEqual(["IR_LOAD", "PC_INC"]);
    expect(h.clock).toBe(true);
    expect(h.control.active).toBe(false); // nenhum sinal passa pelo barramento do sistema
  });

  it("leitura com MISS: endereço e controle vão até a RAM, passando pela cache", () => {
    const h = highlightsFor(
      micro({
        activeComponents: ["CONTROL_UNIT", "MAR", "CACHE", "RAM"],
        buses: { address: 0x20, control: ["CLOCK", "MEM_READ"] },
        cache: { type: "MISS", index: 0, tag: 4 },
      }),
    );
    expect(h.address).toMatchObject({ active: true, from: "CPU", to: "RAM", value: 0x20 });
    expect(h.control).toMatchObject({ active: true, from: "CPU", to: "RAM", signals: ["MEM_READ"], broadcast: false });
    expect(h.data.active).toBe(false);
    expect(h.cache).toEqual({ type: "MISS", index: 0 });
  });

  it("leitura com HIT: o dado sai da cache em direção à CPU", () => {
    const h = highlightsFor(
      micro({ activeComponents: ["CACHE", "MDR"], buses: { address: 0x05, data: 0x1234, control: ["CLOCK", "MEM_READ"] } }),
    );
    expect(h.address).toMatchObject({ from: "CPU", to: "CACHE" });
    expect(h.data).toMatchObject({ active: true, from: "CACHE", to: "CPU", value: 0x1234 });
  });

  it("escrita: o dado vai da CPU para o componente mais distante", () => {
    const ram = highlightsFor(
      micro({
        activeComponents: ["CONTROL_UNIT", "MAR", "MDR", "CACHE", "RAM"],
        buses: { address: 0x30, data: 9, control: ["CLOCK", "MEM_WRITE"] },
      }),
    );
    expect(ram.data).toMatchObject({ from: "CPU", to: "RAM", value: 9 });
    const display = highlightsFor(
      micro({ activeComponents: ["DISPLAY"], buses: { address: 0xf1, data: 12, control: ["CLOCK", "MEM_WRITE"] } }),
    );
    expect(display.data).toMatchObject({ from: "CPU", to: "DISPLAY", value: 12 });
  });

  it("E/S sem dispositivo: o endereço fica parado na CPU", () => {
    const h = highlightsFor(micro({ activeComponents: ["CONTROL_UNIT", "MAR"], buses: { address: 0xf5, control: ["CLOCK", "MEM_READ"] } }));
    expect(h.address).toMatchObject({ active: true, from: "CPU", to: "CPU" });
  });

  it("BOOT: o programa vai do disco para a RAM e RESET é difundido", () => {
    const h = highlightsFor(micro({ phase: "BOOT", activeComponents: ["DISK", "RAM"], buses: { control: ["RESET"] } }));
    expect(h.data).toMatchObject({ active: true, from: "DISK", to: "RAM", label: "programa" });
    expect(h.control).toMatchObject({ active: true, signals: ["RESET"], broadcast: true });
    expect(h.address.active).toBe(false);
    expect(h.clock).toBe(false);
  });

  it("repassa o evento BYPASS da cache", () => {
    const h = highlightsFor(micro({ cache: { type: "BYPASS", index: 0, tag: 0x1e } }));
    expect(h.cache).toEqual({ type: "BYPASS", index: 0 });
  });
});
