// Máquina NeoCore-8: API do motor (§5.1).
//
// Os estados são imutáveis: cada função devolve um novo estado, e o histórico
// guardado pela interface permite voltar microetapas.

import { createCache } from "./cache";
import { executeMicroOp } from "./controlUnit";
import { createIo, setKeyboard } from "./io";
import { toHex } from "./isa";
import { createMemory } from "./memory";
import type { MachineState, MicroStep, Word } from "./types";

export type MachineOptions = {
  readonly keyboard?: Word; // valor inicial do teclado (0xF0)
};

/** Limite padrão de microetapas em run(), para não travar em laços infinitos. */
export const DEFAULT_MAX_STEPS = 10_000;

/**
 * Cria a máquina com o programa gravado no disco. A RAM começa vazia: a
 * primeira microetapa (BOOT) é o loader copiando o programa para a RAM.
 */
export function createMachine(program: readonly Word[], options: MachineOptions = {}): MachineState {
  createMemory(program); // valida o programa já na criação, e não no meio da execução
  return {
    registers: [0, 0, 0, 0],
    pc: 0,
    ir: 0,
    mar: 0,
    mdr: 0,
    flags: { Z: false, N: false, C: false, V: false },
    memory: createMemory(),
    cache: createCache(),
    io: createIo(options.keyboard),
    disk: [...program],
    aluOutput: 0,
    cycle: 0,
    phase: "BOOT",
    microIndex: 0,
    halted: false,
  };
}

/** Avança uma microetapa. Em uma máquina parada, devolve o mesmo estado. */
export function step(state: MachineState): { state: MachineState; micro: MicroStep } {
  const { state: next, micro } = executeMicroOp(state);
  // Cada microetapa da CPU dura 1 ciclo, mais os ciclos de espera da RAM (em MISS e em escrita).
  // O carregamento (BOOT) e a máquina parada não consomem ciclos da CPU.
  const cost = micro.phase === "BOOT" || micro.phase === "HALT" ? 0 : 1 + (micro.waitCycles ?? 0);
  const cycle = state.cycle + cost;
  return {
    state: { ...next, cycle },
    micro: { cycle, ...micro, changes: diff(state, next) },
  };
}

/** Avança até o fim da instrução atual (início da próxima busca) ou até a máquina parar. */
export function stepInstruction(state: MachineState): { state: MachineState; micros: MicroStep[] } {
  const micros: MicroStep[] = [];
  let current = state;
  while (!current.halted) {
    const result = step(current);
    current = result.state;
    micros.push(result.micro);
    if (current.phase === "FETCH" && current.microIndex === 0) {
      break;
    }
  }
  return { state: current, micros };
}

/** Executa até HLT, até uma exceção ou até `maxSteps` microetapas. */
export function run(state: MachineState, maxSteps = DEFAULT_MAX_STEPS): { state: MachineState; micros: MicroStep[] } {
  const micros: MicroStep[] = [];
  let current = state;
  while (!current.halted && micros.length < maxSteps) {
    const result = step(current);
    current = result.state;
    micros.push(result.micro);
  }
  return { state: current, micros };
}

/** Volta ao boot com o mesmo programa do disco. A entrada do teclado é mantida. */
export function reset(state: MachineState): MachineState {
  return createMachine(state.disk, { keyboard: state.io.keyboard });
}

/** Grava um novo programa no disco e reinicia a máquina. */
export function load(state: MachineState, program: readonly Word[]): MachineState {
  return createMachine(program, { keyboard: state.io.keyboard });
}

/** Atualiza o valor digitado no teclado, a qualquer momento da execução. */
export function setKeyboardInput(state: MachineState, value: Word): MachineState {
  return { ...state, io: setKeyboard(state.io, value) };
}

/** Lista o que mudou entre dois estados: registradores, flags, memória e saídas de E/S. */
function diff(before: MachineState, after: MachineState): MicroStep["changes"] {
  const changes: MicroStep["changes"] = [];
  const compare = (target: string, from: number, to: number) => {
    if (from !== to) {
      changes.push({ target, from, to });
    }
  };

  before.registers.forEach((value, index) => compare(`R${index}`, value, after.registers[index]));
  compare("PC", before.pc, after.pc);
  compare("IR", before.ir, after.ir);
  compare("MAR", before.mar, after.mar);
  compare("MDR", before.mdr, after.mdr);
  for (const flag of ["Z", "N", "C", "V"] as const) {
    compare(`FLAGS.${flag}`, Number(before.flags[flag]), Number(after.flags[flag]));
  }
  before.memory.forEach((value, address) => compare(`M[${toHex(address, 2)}]`, value, after.memory[address]));
  compare("DISPLAY", before.io.display, after.io.display);
  compare("LED", before.io.led, after.io.led);
  return changes;
}
