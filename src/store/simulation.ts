// Estado da simulação na interface (zustand).
// A UI só lê estados do motor e dispara ações; toda a lógica vive em src/core.
//
// A execução é guardada como uma lista de "frames" (estado da máquina + a
// microetapa que o produziu) e um cursor. Voltar, avançar e clicar na linha
// do tempo só movem o cursor. Como o motor é determinístico, avançar a partir
// de um frame anterior reaproveita os frames seguintes, que seriam idênticos.

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { assemble } from "@/core/assembler";
import { createMachine, DEFAULT_MAX_STEPS, load, reset, setKeyboardInput, step } from "@/core/machine";
import { EXAMPLES, type ExampleProgram } from "@/core/programs";
import type { MachineState, MicroStep, Word } from "@/core/types";

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Intervalo entre microetapas na velocidade 1× (2,5 microetapas por segundo). */
export const BASE_INTERVAL_MS = 400;

/** Máximo de microetapas guardadas, como em run(): protege contra laços infinitos. */
export const MAX_MICROSTEPS = DEFAULT_MAX_STEPS;

export const LIMIT_NOTICE = `Limite de ${MAX_MICROSTEPS.toLocaleString("pt-BR")} microetapas atingido: o programa pode estar em um laço infinito. Use Reset.`;

export type Frame = {
  readonly machine: MachineState;
  readonly micro?: MicroStep; // ausente no frame inicial
};

export type SimulationState = {
  readonly frames: readonly Frame[];
  readonly cursor: number;
  readonly running: boolean;
  readonly speed: Speed;
  readonly programName: string;
  readonly loadedSource: string; // código do programa que está no disco
  readonly draft: string; // texto atual do editor
  readonly notice?: string; // aviso para o usuário (ex.: limite atingido)
};

export type SimulationActions = {
  stepMicro: () => void;
  stepInstruction: () => void;
  back: () => void;
  goTo: (index: number) => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
  toggleRun: () => void;
  tick: () => void; // uma microetapa da execução contínua
  setSpeed: (speed: Speed) => void;
  setKeyboard: (value: Word) => void;
  setDraft: (text: string) => void;
  loadProgram: (program: readonly Word[], name: string, source: string, keyboard?: Word) => void;
};

export type SimulationStore = SimulationState & SimulationActions;

type Timeline = Pick<SimulationState, "frames" | "cursor">;

/** Avança uma microetapa: reaproveita o frame seguinte, se existir, ou executa o motor. */
function advance({ frames, cursor }: Timeline): Timeline | undefined {
  if (cursor < frames.length - 1) {
    return { frames, cursor: cursor + 1 };
  }
  const { machine } = frames[cursor];
  if (machine.halted || frames.length > MAX_MICROSTEPS) {
    return undefined;
  }
  const result = step(machine);
  return { frames: [...frames, { machine: result.state, micro: result.micro }], cursor: cursor + 1 };
}

function atLimit({ frames, cursor }: Timeline): boolean {
  return cursor === frames.length - 1 && frames.length > MAX_MICROSTEPS && !frames[cursor].machine.halted;
}

function exampleMachine(example: ExampleProgram): MachineState {
  const result = assemble(example.source);
  if (!result.ok) {
    throw new Error(`O exemplo "${example.name}" não montou: ${result.errors[0].message}`);
  }
  return createMachine(result.program, { keyboard: example.keyboard });
}

export function createSimulationStore(example: ExampleProgram = EXAMPLES[0]) {
  return createStore<SimulationStore>()((set, get) => ({
    frames: [{ machine: exampleMachine(example) }],
    cursor: 0,
    running: false,
    speed: 1,
    programName: example.name,
    loadedSource: example.source,
    draft: example.source,
    notice: undefined,

    stepMicro: () => {
      const timeline = advance(get()) ?? get();
      set({ frames: timeline.frames, cursor: timeline.cursor, notice: atLimit(timeline) ? LIMIT_NOTICE : undefined });
    },

    // Avança até o início da próxima busca (ou até a máquina parar).
    stepInstruction: () => {
      let timeline: Timeline = get();
      for (let next = advance(timeline); next; next = advance(timeline)) {
        timeline = next;
        const { machine } = timeline.frames[timeline.cursor];
        if (machine.halted || (machine.phase === "FETCH" && machine.microIndex === 0)) break;
      }
      set({ frames: timeline.frames, cursor: timeline.cursor, notice: atLimit(timeline) ? LIMIT_NOTICE : undefined });
    },

    back: () => set((state) => ({ cursor: Math.max(0, state.cursor - 1), running: false, notice: undefined })),

    goTo: (index) =>
      set((state) => ({ cursor: Math.min(Math.max(0, index), state.frames.length - 1), running: false, notice: undefined })),

    reset: () =>
      set((state) => ({
        frames: [{ machine: reset(state.frames[state.cursor].machine) }],
        cursor: 0,
        running: false,
        notice: undefined,
      })),

    play: () => {
      const { frames, cursor } = get();
      if (!frames[cursor].machine.halted && !atLimit(get())) {
        set({ running: true, notice: undefined });
      }
    },

    pause: () => set({ running: false }),

    toggleRun: () => (get().running ? get().pause() : get().play()),

    tick: () => {
      if (!get().running) return;
      const next = advance(get());
      const timeline = next ?? get();
      const halted = timeline.frames[timeline.cursor].machine.halted;
      const limit = atLimit(timeline);
      set({
        frames: timeline.frames,
        cursor: timeline.cursor,
        running: next !== undefined && !halted && !limit,
        notice: limit ? LIMIT_NOTICE : undefined,
      });
    },

    setSpeed: (speed) => set({ speed }),

    // A entrada do teclado muda o que o programa lê: os frames "futuros" deixam de valer.
    setKeyboard: (value) =>
      set((state) => {
        const current = state.frames[state.cursor];
        return {
          frames: [...state.frames.slice(0, state.cursor), { ...current, machine: setKeyboardInput(current.machine, value) }],
          notice: undefined,
        };
      }),

    setDraft: (text) => set({ draft: text }),

    loadProgram: (program, name, source, keyboard) =>
      set((state) => {
        const current = state.frames[state.cursor].machine;
        const loaded = load(current, program);
        return {
          frames: [{ machine: keyboard === undefined ? loaded : setKeyboardInput(loaded, keyboard) }],
          cursor: 0,
          running: false,
          programName: name,
          loadedSource: source,
          notice: undefined,
        };
      }),
  }));
}

/** Store usada pela aplicação. */
export const simulationStore = createSimulationStore();

export function useSimulation<T>(selector: (state: SimulationStore) => T): T {
  return useStore(simulationStore, selector);
}

/** Frame exibido (posição do cursor). */
export function currentFrame(state: SimulationState): Frame {
  return state.frames[state.cursor];
}
