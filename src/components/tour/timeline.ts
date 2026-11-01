// Linha do tempo do tour: converte o tempo decorrido em cena e frame (sem React).

import type { TourScene } from "./scenes";

export type TourPosition = {
  readonly sceneIndex: number;
  readonly frame: number; // frame do exemplo 1 a exibir
  readonly sceneElapsedMs: number; // tempo dentro da cena
  readonly sceneProgress: number; // 0–1
};

export function totalMs(scenes: readonly TourScene[]): number {
  return scenes.reduce((sum, scene) => sum + scene.seconds * 1000, 0);
}

/** Instante (ms) em que cada cena começa. */
export function sceneStartMs(scenes: readonly TourScene[], index: number): number {
  return totalMs(scenes.slice(0, index));
}

/**
 * Posição do tour em um instante. Dentro de uma cena, os frames são distribuídos
 * por igual ao longo da duração; no fim do tour, fica no último frame.
 */
export function tourPosition(scenes: readonly TourScene[], elapsedMs: number): TourPosition {
  const total = totalMs(scenes);
  const t = Math.min(Math.max(elapsedMs, 0), total);
  let start = 0;
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    const scene = scenes[sceneIndex];
    const duration = scene.seconds * 1000;
    const isLast = sceneIndex === scenes.length - 1;
    if (t < start + duration || isLast) {
      const sceneElapsedMs = Math.min(t - start, duration);
      const sceneProgress = sceneElapsedMs / duration;
      const [first, last] = scene.frames;
      const count = last - first + 1;
      const frame = Math.min(first + Math.floor(sceneProgress * count), last);
      return { sceneIndex, frame, sceneElapsedMs, sceneProgress };
    }
    start += duration;
  }
  throw new Error("O tour precisa de pelo menos uma cena.");
}

/** Formata milissegundos como mm:ss. */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
