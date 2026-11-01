"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assemble } from "@/core/assembler";
import { toHex } from "@/core/isa";
import { createMachine, step } from "@/core/machine";
import { IO_REGION_START } from "@/core/memory";
import { EXAMPLES } from "@/core/programs";
import type { MachineState, MicroStep } from "@/core/types";
import { Diagram } from "@/components/diagram/Diagram";
import { PHASE_NAME } from "@/components/panels/StepExplanation";
import { SiteNav } from "@/components/SiteNav";
import { SCENES, TOUR_KEYBOARD_INPUT } from "./scenes";
import { formatClock, sceneStartMs, totalMs, tourPosition } from "./timeline";

type Frame = { machine: MachineState; micro?: MicroStep };

/**
 * Execução completa do exemplo 1, frame a frame (0 = antes do boot), e os
 * endereços que o assembler gerou com `.word` (dados, não instruções).
 */
export function exampleRun(): { frames: Frame[]; dataAddresses: ReadonlySet<number> } {
  const result = assemble(EXAMPLES[0].source);
  if (!result.ok) throw new Error("O exemplo 1 não montou.");
  const frames: Frame[] = [{ machine: createMachine(result.program, { keyboard: TOUR_KEYBOARD_INPUT }) }];
  while (!frames[frames.length - 1].machine.halted) {
    const { state, micro } = step(frames[frames.length - 1].machine);
    frames.push({ machine: state, micro });
  }
  const dataAddresses = new Set(result.listing.filter((line) => line.kind === "data").map((line) => line.address!));
  return { frames, dataAddresses };
}

// A execução do tour é sempre a mesma (o motor é determinístico): calculada uma vez.
const EXAMPLE_RUN = exampleRun();
const TOTAL_MS = totalMs(SCENES);
const TICK_MS = 100;

/** Modo Roteiro (§10): executa o exemplo 1 em sequência fixa, com as cenas e falas do roteiro do vídeo. */
export function Tour() {
  const { frames, dataAddresses } = EXAMPLE_RUN;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startedAt = useRef(0);

  const position = tourPosition(SCENES, elapsed);
  const scene = SCENES[position.sceneIndex];
  const { machine, micro } = frames[position.frame];
  const finished = elapsed >= TOTAL_MS;

  // O relógio usa o horário real (não soma ticks), para não atrasar durante a gravação.
  useEffect(() => {
    if (!playing) return;
    startedAt.current = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      const now = performance.now() - startedAt.current;
      if (now >= TOTAL_MS) {
        setElapsed(TOTAL_MS);
        setPlaying(false);
      } else {
        setElapsed(now);
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // `elapsed` só é lido ao (re)iniciar; não deve reiniciar o relógio a cada tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const goToScene = useCallback((index: number) => {
    const clamped = Math.min(Math.max(index, 0), SCENES.length - 1);
    const start = sceneStartMs(SCENES, clamped);
    startedAt.current = performance.now() - start;
    setElapsed(start);
  }, []);

  const togglePlay = useCallback(() => {
    if (finished) {
      setElapsed(0);
      setPlaying(true);
    } else {
      setPlaying((value) => !value);
    }
  }, [finished]);

  const restart = () => {
    setPlaying(false);
    setElapsed(0);
  };

  // Atalhos: Espaço inicia/pausa; ← e → trocam de cena.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      if (event.key === " ") {
        // Espaço sobre um botão já o aciona; o atalho vale fora dos botões.
        if (target?.closest("button")) return;
        togglePlay();
      } else if (event.key === "ArrowRight") goToScene(position.sceneIndex + 1);
      else if (event.key === "ArrowLeft") goToScene(position.sceneIndex - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToScene, togglePlay, position.sceneIndex]);

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-2xl font-bold leading-none tracking-wide">Tour guiado</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Exemplo 1 (soma simples, entrada {TOUR_KEYBOARD_INPUT}) em {SCENES.length} cenas · {formatClock(TOTAL_MS)}
            </p>
          </div>
          <SiteNav current="/tour" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 p-4">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" aria-label="Cenas">
          {SCENES.map((item, index) => {
            const isCurrent = index === position.sceneIndex;
            const done = index < position.sceneIndex;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goToScene(index)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`relative flex h-full w-full flex-col overflow-hidden rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    isCurrent ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink"
                  }`}
                >
                  <span className="font-mono text-xs opacity-80">
                    {item.id} · {item.seconds} s{done ? " · ✓" : ""}
                  </span>
                  <span className="font-semibold leading-snug">{item.title}</span>
                  {isCurrent && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-0 h-1 bg-marker"
                      style={{ width: `${position.sceneProgress * 100}%` }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
          <section aria-label="Diagrama da arquitetura" className="panel self-start overflow-x-auto">
            <div className="min-w-[760px]">
              <Diagram state={machine} micro={micro} />
            </div>
          </section>

          <aside className="flex flex-col gap-4" aria-label="Legenda da cena">
            <section className="panel flex flex-col gap-3 p-5" aria-live="polite">
              <p className="panel-title">
                Cena {scene.id} de {SCENES.length}
              </p>
              <h2 className="text-2xl font-bold leading-tight">{scene.title}</h2>
              <p className="text-lg leading-relaxed">{scene.narration}</p>
            </section>

            <section className="panel flex flex-col gap-1 p-4">
              <p className="panel-title">Na simulação</p>
              {micro ? (
                <>
                  <p className="text-sm text-ink-muted">
                    {PHASE_NAME[micro.phase]}
                    {micro.instruction ? ` · ${micro.instruction}` : ""} · ciclo {micro.cycle}
                  </p>
                  <p className="font-semibold">{micro.title}</p>
                  <p className="text-sm">{micro.explanation}</p>
                </>
              ) : (
                <p className="text-sm">O programa está no disco; a máquina ainda não foi ligada.</p>
              )}
            </section>

            <RamContents machine={machine} micro={micro} dataAddresses={dataAddresses} />
          </aside>
        </div>

        <div className="panel flex flex-wrap items-center gap-3 p-3" role="toolbar" aria-label="Controles do tour">
          <TourButton onClick={() => goToScene(position.sceneIndex - 1)} disabled={position.sceneIndex === 0} label="Cena anterior (←)">
            ⏮ Cena anterior
          </TourButton>
          <TourButton onClick={togglePlay} label={playing ? "Pausar (Espaço)" : finished ? "Recomeçar (Espaço)" : "Iniciar (Espaço)"} primary>
            {playing ? "❚❚ Pausar" : finished ? "↺ Recomeçar" : elapsed > 0 ? "▶ Continuar" : "▶ Iniciar"}
          </TourButton>
          <TourButton
            onClick={() => goToScene(position.sceneIndex + 1)}
            disabled={position.sceneIndex === SCENES.length - 1}
            label="Próxima cena (→)"
          >
            Próxima cena ⏭
          </TourButton>
          <TourButton onClick={restart} label="Voltar ao início">
            ↺ Início
          </TourButton>
          <div className="flex min-w-[12rem] flex-1 items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-paper"
              role="progressbar"
              aria-label="Progresso do tour"
              aria-valuemin={0}
              aria-valuemax={Math.round(TOTAL_MS / 1000)}
              aria-valuenow={Math.round(elapsed / 1000)}
              aria-valuetext={`${formatClock(elapsed)} de ${formatClock(TOTAL_MS)}`}
            >
              <div className="h-full bg-ink" style={{ width: `${(elapsed / TOTAL_MS) * 100}%` }} />
            </div>
            <span className="font-mono text-sm">
              {formatClock(elapsed)} / {formatClock(TOTAL_MS)}
            </span>
          </div>
        </div>
      </main>
    </>
  );
}

/** Palavras não nulas da RAM: instruções e dados lado a lado, na mesma memória (Von Neumann). */
function RamContents({ machine, micro, dataAddresses }: Frame & { dataAddresses: ReadonlySet<number> }) {
  const words = machine.memory
    .slice(0, IO_REGION_START)
    .map((word, address) => ({ word, address }))
    .filter(({ word }) => word !== 0);
  return (
    <section className="panel p-4" aria-labelledby="tour-ram">
      <h2 id="tour-ram" className="panel-title mb-2">
        Memória (RAM)
      </h2>
      {words.length === 0 ? (
        <p className="text-sm text-ink-muted">Vazia: o programa ainda está no disco.</p>
      ) : (
        <ul className="flex flex-col gap-0.5 font-mono text-sm">
          {words.map(({ word, address }) => (
            <li
              key={address}
              className={`grid grid-cols-[3rem_4rem_1fr] rounded px-1.5 ${address === micro?.buses.address ? "bg-active text-active-fg" : ""}`}
            >
              <span className={address === micro?.buses.address ? "" : "text-ink-muted"}>{toHex(address, 2)}</span>
              <span>{toHex(word, 4)}</span>
              <span className="text-xs">
                {dataAddresses.has(address) ? "dado" : "instrução"}
                {address === machine.pc ? " ◀ PC" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TourButton({
  children,
  onClick,
  label,
  disabled = false,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-md border px-3.5 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? "border-ink bg-ink text-paper hover:opacity-90" : "border-line bg-surface hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
