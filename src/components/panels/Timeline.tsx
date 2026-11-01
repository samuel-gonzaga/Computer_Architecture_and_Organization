"use client";

import { useEffect, useRef } from "react";
import type { Frame } from "@/store/simulation";
import { PHASE_NAME } from "./StepExplanation";

type Props = {
  frames: readonly Frame[];
  cursor: number;
  onSelect: (index: number) => void;
};

/** Quantas microetapas mostrar de cada lado da atual (a lista pode chegar a 10.000). */
const WINDOW = 150;

/** Linha do tempo: as microetapas executadas; clicar em uma leva a simulação até ela. */
export function Timeline({ frames, cursor, onSelect }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  // Mantém a microetapa atual visível, rolando só a lista (não a página).
  useEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (list && current) {
      list.scrollTop = current.offsetTop - list.clientHeight / 2;
    }
  }, [cursor, frames.length]);

  if (frames.length === 1) {
    return <p className="text-sm text-ink-muted">Nenhuma microetapa executada ainda.</p>;
  }

  const first = Math.max(1, cursor - WINDOW);
  const last = Math.min(frames.length - 1, cursor + WINDOW);
  const visible = frames.slice(first, last + 1);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-muted">
        {frames.length - 1} microetapas registradas. Clique em uma para voltar (ou avançar) até ela.
      </p>
      <ol ref={listRef} className="relative max-h-72 overflow-y-auto rounded-md border border-line" aria-label="Linha do tempo">
        {first > 1 && <li className="px-3 py-1 text-sm text-ink-muted">… {first - 1} anteriores</li>}
        {visible.map((frame, offset) => {
          const index = first + offset;
          const micro = frame.micro!;
          const isCurrent = index === cursor;
          return (
            <li key={index} ref={isCurrent ? currentRef : undefined}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={`grid w-full grid-cols-[3.5rem_7.5rem_9rem_1fr] items-baseline gap-2 border-t border-line px-3 py-1 text-left text-sm first:border-t-0 hover:bg-paper focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink ${
                  isCurrent ? "bg-active font-semibold text-active-fg hover:bg-active" : index > cursor ? "text-ink-muted" : ""
                }`}
              >
                <span className="font-mono">{micro.cycle}</span>
                <span className="text-xs uppercase tracking-wider">{PHASE_NAME[micro.phase]}</span>
                <span className="truncate font-mono text-xs">{micro.instruction ?? ""}</span>
                <span className="truncate">{micro.title}</span>
              </button>
            </li>
          );
        })}
        {last < frames.length - 1 && <li className="px-3 py-1 text-sm text-ink-muted">… {frames.length - 1 - last} seguintes</li>}
      </ol>
    </div>
  );
}
