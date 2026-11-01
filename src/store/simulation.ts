// Estado da simulação na interface (zustand).
// A UI só lê estados do motor e dispara ações; toda a lógica vive em src/core.

import { create } from "zustand";
import { assemble } from "@/core/assembler";
import { createMachine, reset, step } from "@/core/machine";
import { EXAMPLES } from "@/core/programs";
import type { MachineState, MicroStep } from "@/core/types";

type Snapshot = {
  readonly machine: MachineState;
  readonly micro?: MicroStep;
};

type SimulationStore = Snapshot & {
  readonly history: readonly Snapshot[]; // estados anteriores, para voltar
  stepMicro: () => void;
  back: () => void;
  reset: () => void;
};

function initialMachine(): MachineState {
  const example = EXAMPLES[0];
  const result = assemble(example.source);
  if (!result.ok) {
    throw new Error(`O exemplo "${example.name}" não montou: ${result.errors[0].message}`);
  }
  return createMachine(result.program, { keyboard: example.keyboard });
}

export const useSimulation = create<SimulationStore>()((set, get) => ({
  machine: initialMachine(),
  micro: undefined,
  history: [],

  stepMicro: () => {
    const { machine, micro, history } = get();
    if (machine.halted) return;
    const result = step(machine);
    set({ machine: result.state, micro: result.micro, history: [...history, { machine, micro }] });
  },

  back: () => {
    const { history } = get();
    const previous = history[history.length - 1];
    if (!previous) return;
    set({ machine: previous.machine, micro: previous.micro, history: history.slice(0, -1) });
  },

  reset: () => {
    set({ machine: reset(get().machine), micro: undefined, history: [] });
  },
}));
