// Utilitários compartilhados pelos testes do motor.

import { assemble } from "@/core/assembler";
import { createMachine, run } from "@/core/machine";
import type { MachineState, MicroStep, Word } from "@/core/types";

export function assembleOrThrow(source: string): Word[] {
  const result = assemble(source);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }
  return result.program;
}

/** Monta e executa um programa até HLT (ou exceção). */
export function runSource(source: string, keyboard = 0): { state: MachineState; micros: MicroStep[] } {
  return run(createMachine(assembleOrThrow(source), { keyboard }));
}

/** Agrupa as microetapas por instrução (cada grupo começa na busca). O BOOT fica de fora. */
export function splitByInstruction(micros: MicroStep[]): MicroStep[][] {
  const groups: MicroStep[][] = [];
  micros.forEach((micro, index) => {
    if (micro.phase === "BOOT" || micro.phase === "HALT") {
      return;
    }
    const startsInstruction = micro.phase === "FETCH" && micros[index - 1]?.phase !== "FETCH";
    if (startsInstruction) {
      groups.push([]);
    }
    groups[groups.length - 1].push(micro);
  });
  return groups;
}

/** O que identifica a "forma" de uma microetapa, sem os valores transportados. */
export function shape(micro: MicroStep) {
  return {
    phase: micro.phase,
    title: micro.title,
    activeComponents: micro.activeComponents,
    control: micro.buses.control,
    waitCycles: micro.waitCycles,
  };
}

/** Microetapas de EXECUÇÃO da n-ésima instrução executada (a partir de 0). */
export function executeMicros(micros: MicroStep[], n: number): MicroStep[] {
  return splitByInstruction(micros)[n].filter((micro) => micro.phase === "EXECUTE");
}
