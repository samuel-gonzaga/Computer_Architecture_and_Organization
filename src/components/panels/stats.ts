// Estatísticas da execução até o frame atual (sem React).

import { cacheStatistics, type CacheStatistics } from "@/core/cache";
import type { Frame } from "@/store/simulation";

export type ExecutionStats = CacheStatistics & {
  readonly microSteps: number;
  readonly instructions: number; // instruções decodificadas
  readonly cyclesPerInstruction?: number;
};

export function executionStats(frames: readonly Frame[], cursor: number): ExecutionStats {
  const machine = frames[cursor].machine;
  const executed = frames.slice(1, cursor + 1);
  const instructions = executed.filter((frame) => frame.micro?.phase === "DECODE").length;
  return {
    ...cacheStatistics(machine.cache, machine.cycle),
    microSteps: executed.filter((frame) => frame.micro?.phase !== "BOOT").length,
    instructions,
    cyclesPerInstruction: instructions > 0 ? machine.cycle / instructions : undefined,
  };
}
