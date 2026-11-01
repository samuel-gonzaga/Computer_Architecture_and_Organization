import { toHex } from "@/core/isa";
import type { MachineState, MicroStep, Phase } from "@/core/types";
import { InstructionBits } from "./InstructionBits";

export const PHASE_NAME: Record<Phase, string> = {
  BOOT: "Carga",
  FETCH: "Busca",
  DECODE: "Decodificação",
  EXECUTE: "Execução",
  HALT: "Parada",
};

type Props = {
  machine: MachineState;
  micro?: MicroStep;
  notice?: string;
};

function formatChange(target: string, value: number): string {
  if (target.startsWith("FLAGS.")) return String(value);
  const digits = target === "PC" || target === "MAR" ? 2 : 4;
  return toHex(value, digits);
}

/** Painel "O que está acontecendo": exatamente o título e a explicação que o motor gerou. */
export function StepExplanation({ machine, micro, notice }: Props) {
  return (
    <section className="panel flex flex-col gap-3 p-4" aria-labelledby="step-heading">
      <h2 className="panel-title">O que está acontecendo</h2>
      {notice && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {notice}
        </p>
      )}
      <div aria-live="polite" className="flex flex-col gap-2">
        {micro ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <span className="rounded-full border border-line px-2 py-0.5">{PHASE_NAME[micro.phase]}</span>
              {micro.instruction && <span className="font-mono normal-case tracking-normal">{micro.instruction}</span>}
              <span className="ml-auto font-mono normal-case tracking-normal">ciclo {micro.cycle}</span>
            </p>
            <h3 id="step-heading" className="text-xl font-bold leading-tight">
              {micro.title}
            </h3>
            <p className="leading-relaxed">{micro.explanation}</p>
          </>
        ) : (
          <>
            <h3 id="step-heading" className="text-xl font-bold leading-tight">
              Pronto para o boot
            </h3>
            <p className="leading-relaxed">
              O programa está no disco. Avance uma microetapa para o loader copiá-lo para a RAM e a CPU começar a busca.
            </p>
          </>
        )}
      </div>

      {micro?.phase === "DECODE" && micro.instruction && (
        <div className="rounded-md border border-line p-3">
          <p className="mb-1 text-xs text-ink-muted">Campos do IR ({toHex(machine.ir, 4)})</p>
          <InstructionBits word={machine.ir} showLabels />
        </div>
      )}

      {micro && (micro.cache || micro.waitCycles) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {micro.cache && (
            <>
              <dt className="text-ink-muted">Cache</dt>
              <dd className="font-mono">
                {micro.cache.type} · linha {micro.cache.index} · tag {toHex(micro.cache.tag, 2)}
              </dd>
            </>
          )}
          {micro.waitCycles !== undefined && (
            <>
              <dt className="text-ink-muted">Espera</dt>
              <dd className="font-mono">+{micro.waitCycles} ciclos (RAM)</dd>
            </>
          )}
        </dl>
      )}

      {micro && micro.changes.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-ink-muted">Alterações</p>
          <ul className="flex flex-wrap gap-1.5 font-mono text-sm">
            {micro.changes.slice(0, 12).map((change) => (
              <li key={change.target} className="rounded border border-line px-1.5 py-0.5">
                {change.target}: {formatChange(change.target, change.from)} → {formatChange(change.target, change.to)}
              </li>
            ))}
            {micro.changes.length > 12 && <li className="px-1.5 py-0.5 text-ink-muted">+{micro.changes.length - 12}</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
