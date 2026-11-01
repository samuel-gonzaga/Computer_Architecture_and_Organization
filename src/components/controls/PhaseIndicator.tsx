import type { Phase } from "@/core/types";

const CYCLE: { phase: Phase; label: string }[] = [
  { phase: "FETCH", label: "Busca" },
  { phase: "DECODE", label: "Decodificação" },
  { phase: "EXECUTE", label: "Execução" },
];

type Props = {
  phase?: Phase; // fase da última microetapa executada
  halted: boolean;
  cycle: number;
};

/** Indicador BUSCA → DECODIFICAÇÃO → EXECUÇÃO, com a fase atual em destaque, e o contador de ciclos. */
export function PhaseIndicator({ phase, halted, cycle }: Props) {
  const status = halted ? "Parada" : phase === "BOOT" ? "Carga do programa" : phase ? undefined : "Antes do boot";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ol className="flex items-center gap-1" aria-label="Fase do ciclo de instrução">
        {CYCLE.map((step, index) => {
          const current = !halted && step.phase === phase;
          return (
            <li key={step.phase} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden className="text-ink-muted">
                  →
                </span>
              )}
              <span
                aria-current={current ? "step" : undefined}
                className={`rounded-md border px-2.5 py-1 text-sm font-bold uppercase tracking-wider ${
                  current ? "border-ink bg-ink text-paper" : "border-line text-ink-muted"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {status && <span className="rounded-full border border-line px-2.5 py-0.5 text-sm">{status}</span>}
      <span className="font-mono text-sm" aria-live="polite">
        ciclo <strong>{cycle}</strong>
      </span>
    </div>
  );
}
