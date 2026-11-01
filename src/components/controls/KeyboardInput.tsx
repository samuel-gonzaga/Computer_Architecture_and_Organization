"use client";

import { useState } from "react";
import { toHex } from "@/core/isa";
import { parseWordInput } from "@/components/format";
import { currentFrame, useSimulation } from "@/store/simulation";

/** Campo do teclado (endereço 0xF0): o valor que o programa lê com LOAD Rx, [0xF0]. */
export function KeyboardInput() {
  const keyboard = useSimulation((state) => currentFrame(state).machine.io.keyboard);
  const setKeyboard = useSimulation((state) => state.setKeyboard);
  // Texto em edição; null = mostrar o valor atual da máquina.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(keyboard);
  const invalid = draft !== null && parseWordInput(draft) === undefined;

  const commit = () => {
    if (draft === null) return;
    const value = parseWordInput(draft);
    if (value !== undefined) {
      if (value !== keyboard) setKeyboard(value);
      setDraft(null);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
      <label htmlFor="keyboard-input" className="text-sm text-ink-muted">
        Teclado <span className="font-mono">0xF0</span>
      </label>
      <input
        id="keyboard-input"
        inputMode="numeric"
        value={text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
        aria-invalid={invalid}
        aria-describedby="keyboard-help"
        className={`w-20 rounded border bg-paper px-2 py-0.5 font-mono focus-visible:outline-2 focus-visible:outline-ink ${
          invalid ? "border-danger" : "border-line"
        }`}
      />
      <span id="keyboard-help" className={`text-xs ${invalid ? "text-danger" : "text-ink-muted"}`}>
        {invalid ? "use −32768…65535 ou 0x0000…0xFFFF" : toHex(keyboard, 4)}
      </span>
    </div>
  );
}
