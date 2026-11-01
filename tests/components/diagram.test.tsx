// Critério de aceite da Fase 4: cada ComponentId e cada barramento acendem
// conforme a MicroStep. O SVG é renderizado de verdade (react-dom/server) em
// todas as microetapas dos 3 programas de exemplo.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Diagram } from "@/components/diagram/Diagram";
import { createMachine, step } from "@/core/machine";
import { EXAMPLES } from "@/core/programs";
import type { ComponentId, MachineState, MicroStep } from "@/core/types";
import { assembleOrThrow } from "../core/helpers";

const ALL_COMPONENTS: ComponentId[] = [
  "CONTROL_UNIT", "ALU", "R0", "R1", "R2", "R3", "PC", "IR", "MAR", "MDR", "FLAGS",
  "CACHE", "RAM", "DISK", "KEYBOARD", "DISPLAY", "LED",
];

function render(state: MachineState, micro?: MicroStep): string {
  return renderToStaticMarkup(<Diagram state={state} micro={micro} />);
}

function attributeMap(markup: string, pattern: RegExp): Map<string, boolean> {
  return new Map([...markup.matchAll(pattern)].map((match) => [match[1], match[2] === "true"]));
}

const components = (markup: string) => attributeMap(markup, /data-component="(\w+)" data-active="(true|false)"/g);
const buses = (markup: string) => attributeMap(markup, /<g data-bus="(\w+)" data-active="(true|false)" role="group"/g);

/** Executa o programa guardando cada estado e a microetapa que o produziu. */
function trace(source: string, keyboard: number): { state: MachineState; micro: MicroStep }[] {
  const frames: { state: MachineState; micro: MicroStep }[] = [];
  let state = createMachine(assembleOrThrow(source), { keyboard });
  while (!state.halted) {
    const result = step(state);
    state = result.state;
    frames.push({ state, micro: result.micro });
  }
  return frames;
}

describe("Diagrama", () => {
  it("desenha os 17 componentes e os 3 barramentos, todos apagados antes do boot", () => {
    const markup = render(createMachine([0xf000]));
    const drawn = components(markup);
    expect([...drawn.keys()].sort()).toEqual([...ALL_COMPONENTS].sort());
    expect([...drawn.values()].every((active) => !active)).toBe(true);
    expect(buses(markup)).toEqual(new Map([["address", false], ["data", false], ["control", false]]));
    expect(markup).toContain("Barramento de endereços · 8 bits");
    expect(markup).toContain("Barramento de dados · 16 bits");
    expect(markup).toContain("Barramento de controle");
  });

  it.each(EXAMPLES.map((example) => [example.name, example] as const))(
    "%s: em cada microetapa, acende exatamente o que a MicroStep descreve",
    (_, example) => {
      for (const { state, micro } of trace(example.source, example.keyboard)) {
        const markup = render(state, micro);
        const drawn = components(markup);
        const expected = new Set(micro.activeComponents);
        for (const id of ALL_COMPONENTS) {
          expect(drawn.get(id), `${id} em "${micro.title}" (ciclo ${micro.cycle})`).toBe(expected.has(id));
        }

        const signals = micro.buses.control;
        expect(buses(markup), `barramentos em "${micro.title}"`).toEqual(
          new Map([
            ["address", micro.buses.address !== undefined],
            ["data", micro.buses.data !== undefined || micro.phase === "BOOT"],
            ["control", signals.includes("MEM_READ") || signals.includes("MEM_WRITE") || signals.includes("RESET")],
          ]),
        );
      }
    },
  );

  it("ao longo dos 3 exemplos, todo componente e todo barramento acende pelo menos uma vez", () => {
    const litComponents = new Set<string>();
    const litBuses = new Set<string>();
    for (const example of EXAMPLES) {
      for (const { state, micro } of trace(example.source, example.keyboard)) {
        const markup = render(state, micro);
        components(markup).forEach((active, id) => active && litComponents.add(id));
        buses(markup).forEach((active, id) => active && litBuses.add(id));
      }
    }
    expect([...litComponents].sort()).toEqual([...ALL_COMPONENTS].sort());
    expect([...litBuses].sort()).toEqual(["address", "control", "data"]);
  });

  it("mostra no barramento o valor transmitido", () => {
    const frames = trace(EXAMPLES[0].source, 5);
    const display = frames.find(({ micro }) => micro.title === "Display responde");
    expect(display).toBeDefined();
    const markup = render(display!.state, display!.micro);
    expect(markup).toMatch(/data-bus="data"[^>]*>[\s\S]*0x000C/);
    expect(markup).toContain("MEM_WRITE");
  });

  it("marca os valores alterados", () => {
    const frames = trace(EXAMPLES[0].source, 5);
    const write = frames.find(({ micro }) => micro.title === "R0 ← resultado");
    const markup = render(write!.state, write!.micro);
    expect(markup).toMatch(/data-component="R0" data-active="true"[\s\S]*?data-changed="true"/);
  });

  it("descreve a microetapa atual para leitores de tela", () => {
    const [boot] = trace(EXAMPLES[0].source, 5);
    expect(render(boot.state, boot.micro)).toContain("<desc id=\"dg-desc\">Loader: disco → RAM.");
  });
});
