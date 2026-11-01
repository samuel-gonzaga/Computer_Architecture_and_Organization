"use client";

import { useRef } from "react";
import { Diagram } from "@/components/diagram/Diagram";
import { exportDiagramPng } from "@/components/diagram/exportPng";
import { useSimulation } from "@/store/simulation";

// Fase 4: prévia do diagrama com controles mínimos (avançar, voltar, reset).
// A Fase 5 substitui esta barra pelos controles e painéis completos (§6).
export function Simulator() {
  const { machine, micro, history, stepMicro, back, reset } = useSimulation();
  const svgRef = useRef<SVGSVGElement>(null);

  const exportPng = () => {
    if (svgRef.current) {
      void exportDiagramPng(svgRef.current, "neocore-diagrama.png");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">NeoCore Computer Lab</h1>
          <p className="text-sm text-ink-muted">Simulador didático da arquitetura NeoCore-8 · prévia do diagrama</p>
        </div>
        <p className="font-mono text-sm" aria-live="polite">
          ciclo {machine.cycle} · {machine.halted ? "parada" : "em execução"}
        </p>
      </header>

      <section aria-label="Diagrama da arquitetura" className="overflow-x-auto rounded-lg border border-line bg-surface">
        <div className="min-w-[880px]">
          <Diagram state={machine} micro={micro} svgRef={svgRef} />
        </div>
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl" aria-live="polite">
          <h2 className="text-lg font-semibold">{micro ? micro.title : "Pronto para o boot"}</h2>
          <p className="text-ink-muted">
            {micro
              ? micro.explanation
              : "O programa de exemplo 1 (soma simples) está no disco. Avance para ver o loader copiá-lo para a RAM."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviewButton onClick={back} disabled={history.length === 0}>
            ◀ Voltar
          </PreviewButton>
          <PreviewButton onClick={stepMicro} disabled={machine.halted} primary>
            Próxima microetapa ▶
          </PreviewButton>
          <PreviewButton onClick={reset}>Reset</PreviewButton>
          <PreviewButton onClick={exportPng}>Exportar PNG</PreviewButton>
        </div>
      </section>
    </main>
  );
}

function PreviewButton({
  children,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-4 py-2 font-semibold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 ${
        primary ? "border-ink bg-ink text-paper hover:opacity-90" : "border-line bg-surface hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
