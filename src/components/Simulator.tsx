"use client";

import { useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Controls } from "@/components/controls/Controls";
import { PhaseIndicator } from "@/components/controls/PhaseIndicator";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { useKeyboardShortcuts, useRunLoop } from "@/components/controls/useSimulationEffects";
import { Diagram } from "@/components/diagram/Diagram";
import { exportDiagramPng } from "@/components/diagram/exportPng";
import { ProgramEditor } from "@/components/editor/ProgramEditor";
import { BottomTabs } from "@/components/panels/BottomTabs";
import { CachePanel } from "@/components/panels/CachePanel";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { RegistersPanel } from "@/components/panels/RegistersPanel";
import { executionStats } from "@/components/panels/stats";
import { StatsPanel } from "@/components/panels/StatsPanel";
import { StepExplanation } from "@/components/panels/StepExplanation";
import { Timeline } from "@/components/panels/Timeline";
import { SiteNav } from "@/components/SiteNav";
import { useSimulation } from "@/store/simulation";

/** Tela do simulador (§6.1): controles no topo, editor à esquerda, diagrama e abas no centro, painéis à direita. */
export function Simulator() {
  useRunLoop();
  useKeyboardShortcuts();

  const { frames, cursor, notice, programName, goTo } = useSimulation(
    useShallow((state) => ({
      frames: state.frames,
      cursor: state.cursor,
      notice: state.notice,
      programName: state.programName,
      goTo: state.goTo,
    })),
  );
  const { machine, micro } = frames[cursor];
  const [editorOpen, setEditorOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const stats = useMemo(() => executionStats(frames, cursor), [frames, cursor]);

  const exportPng = () => {
    if (svgRef.current) void exportDiagramPng(svgRef.current, "neocore-diagrama.png");
  };

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-wide">NeoCore Computer Lab</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Veja a CPU buscar, decodificar e executar cada instrução · Programa:{" "}
                <span className="font-semibold text-ink">{programName}</span>
              </p>
            </div>
            <PhaseIndicator phase={micro?.phase} halted={machine.halted} cycle={machine.cycle} />
            <div className="flex flex-wrap items-center gap-2">
              <SiteNav current="/" />
              <ThemeToggle />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorOpen((open) => !open)}
              aria-expanded={editorOpen}
              aria-controls="editor-panel"
              className="rounded-md border border-line bg-surface px-3.5 py-2 font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {editorOpen ? "◀ Editor" : "Editor ▶"}
            </button>
            <Controls />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto grid w-full max-w-[1800px] flex-1 gap-4 p-4 ${
          editorOpen ? "xl:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)_21rem]" : "xl:grid-cols-[minmax(0,1fr)_21rem]"
        }`}
      >
        {editorOpen && (
          <aside id="editor-panel" className="min-w-0">
            <ProgramEditor onClose={() => setEditorOpen(false)} />
          </aside>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Diagrama da arquitetura" className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <h2 className="panel-title">Diagrama</h2>
              <button
                type="button"
                onClick={exportPng}
                className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
              >
                Exportar PNG
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <Diagram state={machine} micro={micro} svgRef={svgRef} />
              </div>
            </div>
          </section>

          <BottomTabs
            tabs={[
              { id: "memory", label: "Memória", content: <MemoryPanel machine={machine} micro={micro} /> },
              { id: "cache", label: "Cache", content: <CachePanel machine={machine} micro={micro} /> },
              { id: "timeline", label: "Linha do tempo", content: <Timeline frames={frames} cursor={cursor} onSelect={goTo} /> },
              { id: "stats", label: "Estatísticas", content: <StatsPanel stats={stats} /> },
            ]}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Explicação e registradores">
          <StepExplanation machine={machine} micro={micro} notice={notice} />
          <RegistersPanel machine={machine} micro={micro} />
        </aside>
      </main>
    </>
  );
}
