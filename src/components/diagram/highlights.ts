// Traduz uma MicroStep no que o diagrama deve acender. Função pura, sem React.
//
// Regras:
// - Componentes: exatamente os `activeComponents` da microetapa.
// - Barramento de endereços: ativo quando `buses.address` existe; vai da CPU
//   (MAR) até o componente externo mais distante entre os ativos.
// - Barramento de dados: ativo quando `buses.data` existe. Em leitura
//   (MEM_READ) o dado vai do componente para a CPU; em escrita, da CPU para
//   o componente. No BOOT, o programa vai do disco para a RAM.
// - Barramento de controle: só carrega os sinais do sistema (MEM_READ,
//   MEM_WRITE, RESET). RESET é difundido para todos os componentes.
// - Os demais sinais (ALU_OP, REG_WRITE, PC_INC...) são internos à CPU e
//   aparecem na Unidade de Controle; CLOCK aparece como o pulso de clock.

import type { CacheEventType, ComponentId, ControlSignal, MicroStep } from "@/core/types";
import type { Endpoint } from "./layout";

/** Componentes fora da CPU, na ordem em que aparecem ao longo dos barramentos. */
const EXTERNAL_ORDER = ["CACHE", "KEYBOARD", "RAM", "DISPLAY", "DISK", "LED"] as const satisfies readonly Endpoint[];

const SYSTEM_SIGNALS: ControlSignal[] = ["MEM_READ", "MEM_WRITE", "RESET"];

export type BusHighlight = {
  readonly active: boolean;
  readonly from: Endpoint;
  readonly to: Endpoint;
  readonly value?: number;
  readonly label?: string; // texto do valor quando não é um número (ex.: "programa")
  readonly signals: readonly ControlSignal[];
  readonly broadcast: boolean; // ocupa o barramento inteiro (RESET)
};

export type DiagramHighlights = {
  readonly components: ReadonlySet<ComponentId>;
  readonly changed: ReadonlySet<string>; // alvos de `changes` (ex.: "R0", "M[0x20]", "DISPLAY")
  readonly address: BusHighlight;
  readonly data: BusHighlight;
  readonly control: BusHighlight;
  readonly internalSignals: readonly ControlSignal[];
  readonly clock: boolean;
  readonly cache?: { readonly type: CacheEventType; readonly index: number };
};

const IDLE_BUS: BusHighlight = { active: false, from: "CPU", to: "CPU", signals: [], broadcast: false };

export function highlightsFor(micro?: MicroStep): DiagramHighlights {
  if (!micro) {
    return {
      components: new Set(),
      changed: new Set(),
      address: IDLE_BUS,
      data: IDLE_BUS,
      control: IDLE_BUS,
      internalSignals: [],
      clock: false,
    };
  }

  const components = new Set(micro.activeComponents);
  const externals = EXTERNAL_ORDER.filter((endpoint) => components.has(endpoint));
  const farthest: Endpoint = externals[externals.length - 1] ?? "CPU";
  const control = micro.buses.control;
  const systemSignals = control.filter((signal) => SYSTEM_SIGNALS.includes(signal));
  const isWrite = control.includes("MEM_WRITE");
  const isBoot = micro.phase === "BOOT";

  const address: BusHighlight =
    micro.buses.address === undefined
      ? IDLE_BUS
      : { ...IDLE_BUS, active: true, to: farthest, value: micro.buses.address };

  let data: BusHighlight = IDLE_BUS;
  if (isBoot) {
    data = { ...IDLE_BUS, active: true, from: "DISK", to: "RAM", label: "programa" };
  } else if (micro.buses.data !== undefined) {
    data = isWrite
      ? { ...IDLE_BUS, active: true, from: "CPU", to: farthest, value: micro.buses.data }
      : { ...IDLE_BUS, active: true, from: farthest, to: "CPU", value: micro.buses.data };
  }

  const controlBus: BusHighlight =
    systemSignals.length === 0
      ? IDLE_BUS
      : {
          ...IDLE_BUS,
          active: true,
          to: farthest,
          signals: systemSignals,
          broadcast: systemSignals.includes("RESET"),
        };

  return {
    components,
    changed: new Set(micro.changes.map((change) => change.target)),
    address,
    data,
    control: controlBus,
    internalSignals: control.filter((signal) => signal !== "CLOCK" && !SYSTEM_SIGNALS.includes(signal)),
    clock: control.includes("CLOCK"),
    cache: micro.cache && { type: micro.cache.type, index: micro.cache.index },
  };
}
