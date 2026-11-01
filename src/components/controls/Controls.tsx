"use client";

import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { currentFrame, SPEEDS, useSimulation, type Speed } from "@/store/simulation";
import { KeyboardInput } from "./KeyboardInput";

/** Barra de controles (§6.2). Os atalhos de teclado aparecem na dica de cada botão. */
export function Controls() {
  const { halted, canGoBack, running, speed } = useSimulation(
    useShallow((state) => ({
      halted: currentFrame(state).machine.halted,
      canGoBack: state.cursor > 0,
      running: state.running,
      speed: state.speed,
    })),
  );
  const actions = useSimulation(
    useShallow((state) => ({
      reset: state.reset,
      back: state.back,
      stepMicro: state.stepMicro,
      stepInstruction: state.stepInstruction,
      toggleRun: state.toggleRun,
      setSpeed: state.setSpeed,
    })),
  );

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Controles da simulação">
      <ControlButton onClick={actions.reset} shortcut="R" label="Reset">
        ↺ Reset
      </ControlButton>
      <ControlButton onClick={actions.back} disabled={!canGoBack} shortcut="ArrowLeft" label="Voltar uma microetapa (←)">
        ◀ Voltar
      </ControlButton>
      <ControlButton onClick={actions.stepMicro} disabled={halted || running} shortcut="ArrowRight" label="Próxima microetapa (→)" primary>
        Microetapa ▶
      </ControlButton>
      <ControlButton
        onClick={actions.stepInstruction}
        disabled={halted || running}
        shortcut="Shift+ArrowRight"
        label="Próxima instrução (Shift + →)"
      >
        Instrução ▶▶
      </ControlButton>
      <ControlButton
        onClick={actions.toggleRun}
        disabled={halted && !running}
        shortcut="Space"
        label={running ? "Pausar (Espaço)" : "Executar (Espaço)"}
        pressed={running}
      >
        {running ? "❚❚ Pausar" : "▶ Executar"}
      </ControlButton>

      <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
        <span className="text-sm text-ink-muted">Velocidade</span>
        <select
          value={speed}
          onChange={(event) => actions.setSpeed(Number(event.target.value) as Speed)}
          className="bg-transparent font-mono font-semibold focus-visible:outline-2 focus-visible:outline-ink"
        >
          {SPEEDS.map((option) => (
            <option key={option} value={option}>
              {option.toLocaleString("pt-BR")}×
            </option>
          ))}
        </select>
      </label>

      <KeyboardInput />
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  label,
  shortcut,
  disabled = false,
  primary = false,
  pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  shortcut: string;
  disabled?: boolean;
  primary?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={pressed}
      className={`rounded-md border px-3.5 py-2 font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? "border-ink bg-ink text-paper hover:opacity-90" : "border-line bg-surface hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
