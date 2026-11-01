import { toHex } from "@/core/isa";
import type { Flags, MachineState, MicroStep } from "@/core/types";
import { toBinary, toDecimal } from "@/components/format";
import { InstructionBits } from "./InstructionBits";

type Props = {
  machine: MachineState;
  micro?: MicroStep;
};

// `bits` define a largura; só registradores de dados (R0–R3, MDR) mostram também o valor com sinal.
type Row = { name: string; value: number; bits: 8 | 16; description: string; signed?: boolean };

const FLAG_INFO: { key: keyof Flags; description: string }[] = [
  { key: "Z", description: "zero" },
  { key: "N", description: "negativo" },
  { key: "C", description: "carry / borrow" },
  { key: "V", description: "overflow" },
];

/**
 * Registradores (hex + decimal; binário ao passar o mouse ou focar) e flags.
 * Os valores alterados na microetapa piscam.
 */
export function RegistersPanel({ machine, micro }: Props) {
  const changed = new Set(micro?.changes.map((change) => change.target));
  const rows: Row[] = [
    ...machine.registers.map((value, index) => ({ name: `R${index}`, value, bits: 16 as const, description: "uso geral", signed: true })),
    { name: "PC", value: machine.pc, bits: 8, description: "contador de programa" },
    { name: "IR", value: machine.ir, bits: 16, description: "registrador de instrução" },
    { name: "MAR", value: machine.mar, bits: 8, description: "endereço de memória" },
    { name: "MDR", value: machine.mdr, bits: 16, description: "dado de memória", signed: true },
  ];
  // A chave muda a cada microetapa para a animação de "piscar" recomeçar.
  const flashKey = micro?.cycle ?? -1;

  return (
    <section className="panel p-4" aria-labelledby="registers-heading">
      <h2 id="registers-heading" className="panel-title mb-2">
        Registradores
      </h2>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const isChanged = changed.has(row.name);
          return (
            <li
              key={isChanged ? `${row.name}-${flashKey}` : row.name}
              tabIndex={0}
              data-changed={isChanged}
              aria-label={`${row.name}, ${row.description}: ${toHex(row.value, row.bits / 4)}, decimal ${row.value}, binário ${toBinary(row.value, row.bits)}${isChanged ? ", alterado" : ""}`}
              className={`group rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ink ${isChanged ? "flash" : ""}`}
            >
              <div className="grid grid-cols-[3.2rem_1fr_auto] items-baseline gap-2">
                <span className="font-bold">{row.name}</span>
                <span className="font-mono text-lg">{toHex(row.value, row.bits / 4)}</span>
                <span className="font-mono text-sm text-ink-muted">{row.signed ? toDecimal(row.value) : row.value}</span>
              </div>
              <div className="hidden pl-[3.7rem] text-sm group-hover:block group-focus:block">
                {row.name === "IR" ? <InstructionBits word={row.value} showLabels /> : <span className="font-mono">{toBinary(row.value, row.bits)}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <h3 className="panel-title mb-2 mt-4">Flags</h3>
      <ul className="grid grid-cols-4 gap-2">
        {FLAG_INFO.map(({ key, description }) => {
          const set = machine.flags[key];
          const isChanged = changed.has(`FLAGS.${key}`);
          return (
            <li
              key={isChanged ? `${key}-${flashKey}` : key}
              title={description}
              aria-label={`${key} (${description}) = ${set ? 1 : 0}${isChanged ? ", alterada" : ""}`}
              className={`rounded-md border px-2 py-1.5 text-center font-mono ${
                set ? "border-ink bg-ink font-bold text-paper" : "border-line"
              } ${isChanged ? "flash" : ""}`}
            >
              {key}={set ? 1 : 0}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
