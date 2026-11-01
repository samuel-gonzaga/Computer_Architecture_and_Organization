"use client";

import { useEffect } from "react";
import { BASE_INTERVAL_MS, simulationStore, useSimulation } from "@/store/simulation";

/** Executar: um "tick" por intervalo, conforme a velocidade escolhida. */
export function useRunLoop() {
  const running = useSimulation((state) => state.running);
  const speed = useSimulation((state) => state.speed);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => simulationStore.getState().tick(), BASE_INTERVAL_MS / speed);
    return () => window.clearInterval(timer);
  }, [running, speed]);
}

/** Atalhos (§6.2): → microetapa, Shift+→ instrução, ← voltar, Espaço executar/pausar, R reset. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      // Não interfere na digitação nem em controles que usam as setas.
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='tab']")) return;

      const store = simulationStore.getState();
      if (event.key === "ArrowRight") {
        if (store.running) return;
        if (event.shiftKey) store.stepInstruction();
        else store.stepMicro();
      } else if (event.key === "ArrowLeft") {
        store.back();
      } else if (event.key === " ") {
        // Espaço sobre um botão já o aciona; o atalho vale fora dos botões.
        if (target?.closest("button")) return;
        store.toggleRun();
      } else if (event.key === "r" || event.key === "R") {
        store.reset();
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
