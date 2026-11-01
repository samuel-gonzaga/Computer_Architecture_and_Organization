"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type Tab = { id: string; label: string; content: ReactNode };

/** Abas acessíveis (setas esquerda/direita, Home e End trocam de aba). */
export function BottomTabs({ tabs }: { tabs: Tab[] }) {
  const [selected, setSelected] = useState(tabs[0].id);
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + tabs.length) % tabs.length;
    setSelected(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <section className="panel" aria-label="Painéis de memória, cache, linha do tempo e estatísticas">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2">
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px whitespace-nowrap rounded-t-md border px-4 py-2 font-semibold tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                isSelected ? "border-line border-b-surface bg-surface" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selected}
          className="p-4"
        >
          {tab.id === selected && tab.content}
        </div>
      ))}
    </section>
  );
}
