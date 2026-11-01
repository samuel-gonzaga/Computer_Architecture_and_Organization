import type { Word } from "@/core/types";
import { toBinary } from "@/components/format";

const FIELDS = [
  { name: "opcode", short: "op", from: 0, to: 4, className: "text-field-op" },
  { name: "rd", short: "rd", from: 4, to: 6, className: "text-field-rd" },
  { name: "rs", short: "rs", from: 6, to: 8, className: "text-field-rs" },
  { name: "imm/addr", short: "imm/addr", from: 8, to: 16, className: "text-field-imm" },
] as const;

type Props = {
  word: Word;
  kind?: "instruction" | "data";
  showLabels?: boolean; // mostra o nome de cada campo embaixo dos bits
};

/**
 * Palavra em binário. Instruções aparecem separadas nos campos opcode | rd | rs |
 * imm/addr, cada um com cor própria e separado por espaço (a cor não é o único indicador).
 */
export function InstructionBits({ word, kind = "instruction", showLabels = false }: Props) {
  const bits = word.toString(2).padStart(16, "0");
  if (kind === "data") {
    return <span className="font-mono">{toBinary(word)}</span>;
  }
  return (
    <span
      className="inline-flex gap-[0.6ch] font-mono"
      aria-label={FIELDS.map((field) => `${field.name} ${bits.slice(field.from, field.to)}`).join(", ")}
    >
      {FIELDS.map((field) => (
        <span key={field.name} className="inline-flex flex-col items-center" title={field.name}>
          <span className={`font-semibold ${field.className}`}>{bits.slice(field.from, field.to)}</span>
          {showLabels && <span className="text-[10px] uppercase tracking-wider text-ink-muted">{field.short}</span>}
        </span>
      ))}
    </span>
  );
}
