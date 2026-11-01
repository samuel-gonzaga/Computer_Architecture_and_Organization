"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { assemble } from "@/core/assembler";
import { toHex } from "@/core/isa";
import { EXAMPLES } from "@/core/programs";
import { InstructionBits } from "@/components/panels/InstructionBits";
import { currentFrame, useSimulation } from "@/store/simulation";
import { parseProgramFile, PROGRAM_FILE_EXTENSION, programFileName, serializeProgram } from "./programFile";

/** Origem do texto no editor (exemplo ou arquivo importado), para nomear o programa ao carregar. */
type Origin = { name: string; source: string; keyboard?: number };

const CUSTOM_NAME = "Programa próprio";

/**
 * Editor de assembly (§6.4): ao lado de cada linha, o endereço e o código de
 * máquina (hex e binário com os campos coloridos) ou o erro daquela linha.
 * Programa com erro não é carregado.
 */
export function ProgramEditor({ onClose }: { onClose: () => void }) {
  const { draft, loadedSource, programName, keyboard } = useSimulation(
    useShallow((state) => ({
      draft: state.draft,
      loadedSource: state.loadedSource,
      programName: state.programName,
      keyboard: currentFrame(state).machine.io.keyboard,
    })),
  );
  const setDraft = useSimulation((state) => state.setDraft);
  const loadProgram = useSimulation((state) => state.loadProgram);
  const [origin, setOrigin] = useState<Origin | undefined>(() => {
    const example = EXAMPLES.find((candidate) => candidate.source === draft);
    return example && { name: example.name, source: example.source, keyboard: example.keyboard };
  });
  const [message, setMessage] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const result = useMemo(() => assemble(draft), [draft]);
  const lines = draft.split(/\r?\n/);
  const errorsByLine = new Map<number, string[]>();
  if (!result.ok) {
    for (const error of result.errors) {
      errorsByLine.set(error.line, [...(errorsByLine.get(error.line) ?? []), error.message.replace(/^Linha \d+: /, "")]);
    }
  }
  const name = origin && origin.source === draft ? origin.name : draft === loadedSource ? programName : CUSTOM_NAME;
  const selectedExample = EXAMPLES.find((example) => example.source === draft)?.id ?? "";

  const chooseExample = (event: ChangeEvent<HTMLSelectElement>) => {
    const example = EXAMPLES.find((candidate) => candidate.id === event.target.value);
    if (!example) return;
    setDraft(example.source);
    setOrigin({ name: example.name, source: example.source, keyboard: example.keyboard });
    setMessage(`Exemplo "${example.name}" no editor. Clique em "Montar e carregar".`);
  };

  const assembleAndLoad = () => {
    if (!result.ok) return;
    const keyboardForProgram = origin && origin.source === draft ? origin.keyboard : undefined;
    loadProgram(result.program, name, draft, keyboardForProgram);
    setMessage(`"${name}" carregado no disco (${result.program.length} palavras). A máquina voltou ao boot.`);
  };

  const exportFile = () => {
    const blob = new Blob([serializeProgram({ name, source: draft, keyboard })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = programFileName(name);
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseProgramFile(await file.text());
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    setDraft(parsed.file.source);
    setOrigin({ name: parsed.file.name, source: parsed.file.source, keyboard: parsed.file.keyboard });
    setMessage(`"${parsed.file.name}" importado. Clique em "Montar e carregar".`);
  };

  return (
    <section className="panel flex flex-col gap-3 p-4" aria-labelledby="editor-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="editor-heading" className="panel-title">
          Editor de assembly
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line px-2.5 py-1 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          ◀ Recolher
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Exemplos</span>
        <select
          value={selectedExample}
          onChange={chooseExample}
          className="rounded-md border border-line bg-paper px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <option value="" disabled>
            Escolha um exemplo…
          </option>
          {EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {example.name}
            </option>
          ))}
        </select>
      </label>

      <div className="max-h-[55vh] overflow-auto rounded-md border border-line bg-paper">
        <div className="grid min-w-max grid-cols-[2.5rem_minmax(15rem,1fr)_auto] font-mono text-[13px] leading-5">
          <div aria-hidden className="select-none border-r border-line py-2 pr-2 text-right text-ink-muted">
            {lines.map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={lines.length}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Código assembly"
            aria-describedby="editor-status"
            className="resize-none overflow-hidden bg-transparent px-2 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
            style={{ height: `${lines.length * 20 + 16}px` }}
          />
          <div className="border-l border-line py-2 pl-2 pr-3" aria-label="Código de máquina por linha">
            {lines.map((_, index) => {
              const lineNumber = index + 1;
              const errors = errorsByLine.get(lineNumber);
              const entry = result.ok ? result.listing[index] : undefined;
              if (errors) {
                return (
                  <div key={index} className="max-w-[22rem] truncate text-danger" title={errors.join("; ")}>
                    ✖ {errors[0]}
                  </div>
                );
              }
              if (entry?.word !== undefined && entry.address !== undefined) {
                return (
                  <div key={index} className="flex gap-3 whitespace-nowrap">
                    <span className="text-ink-muted">{toHex(entry.address, 2)}</span>
                    <span>{toHex(entry.word, 4)}</span>
                    <InstructionBits word={entry.word} kind={entry.kind} />
                  </div>
                );
              }
              return <div key={index}>&nbsp;</div>;
            })}
          </div>
        </div>
      </div>

      <div id="editor-status" aria-live="polite" className="text-sm">
        {result.ok ? (
          <p className="text-ink-muted">
            Programa válido: {result.program.length} palavras.{" "}
            {draft !== loadedSource ? <strong className="text-ink">Alterações ainda não carregadas.</strong> : "Este é o programa carregado."}
          </p>
        ) : (
          <>
            <p className="font-semibold text-danger">
              {result.errors.length === 1 ? "1 erro" : `${result.errors.length} erros`}: o programa não pode ser carregado.
            </p>
            <ul className="mt-1 list-inside list-disc text-danger">
              {result.errors.slice(0, 6).map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </>
        )}
        {message && <p className="mt-1">{message}</p>}
      </div>

      <p className="text-xs text-ink-muted">
        Campos da instrução: <span className="font-semibold text-field-op">opcode</span> ·{" "}
        <span className="font-semibold text-field-rd">rd</span> · <span className="font-semibold text-field-rs">rs</span> ·{" "}
        <span className="font-semibold text-field-imm">imm/addr</span>. Sintaxe: um comando por linha, <code>;</code> comentário,{" "}
        <code>rotulo:</code>, <code>.org</code>, <code>.word</code>, números em decimal ou <code>0x</code>.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={assembleAndLoad}
          disabled={!result.ok}
          className="rounded-md border border-ink bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Montar e carregar
        </button>
        <button
          type="button"
          onClick={exportFile}
          className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Exportar {PROGRAM_FILE_EXTENSION}
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          Importar…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={`${PROGRAM_FILE_EXTENSION},.json,application/json`}
          onChange={importFile}
          className="hidden"
          aria-label="Importar arquivo .neocore.json"
        />
      </div>
    </section>
  );
}
