import { toHex } from "@/core/isa";
import { deviceAt, readIo } from "@/core/io";
import { IO_REGION_START, isIoAddress } from "@/core/memory";
import type { MachineState, MicroStep } from "@/core/types";

type Props = {
  machine: MachineState;
  micro?: MicroStep;
};

const COLUMNS = Array.from({ length: 16 }, (_, i) => i);
const ROWS = Array.from({ length: 16 }, (_, i) => i * 16);

/** Memória: as 256 palavras em hexadecimal, com o PC e o endereço acessado destacados. */
export function MemoryPanel({ machine, micro }: Props) {
  const accessed = micro?.buses.address;
  const changed = new Set(micro?.changes.map((change) => change.target));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[13px]">
          <caption className="sr-only">Memória principal, 256 palavras de 16 bits</caption>
          <thead>
            <tr>
              <th scope="col" className="px-1 py-1 text-left text-ink-muted">
                end.
              </th>
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-1 py-1 font-normal text-ink-muted">
                  +{column.toString(16).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((base) => (
              <tr key={base}>
                <th scope="row" className="px-1 py-0.5 text-left font-normal text-ink-muted">
                  {toHex(base, 2)}
                </th>
                {COLUMNS.map((column) => {
                  const address = base + column;
                  return (
                    <MemoryCell
                      key={address}
                      address={address}
                      machine={machine}
                      isPc={address === machine.pc}
                      isAccessed={address === accessed}
                      isChanged={changed.has(`M[${toHex(address, 2)}]`)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span>
          <span className="rounded border-2 border-ink px-1 font-mono text-ink">PC</span> próxima instrução
        </span>
        <span>
          <span className="rounded bg-active px-1 font-mono text-active-fg">end.</span> acessado nesta microetapa
        </span>
        <span>
          <span className="rounded bg-marker px-1 font-mono text-marker-ink">valor</span> alterado
        </span>
        <span>
          {toHex(IO_REGION_START, 2)}–0xFF: E/S mapeada em memória (não é RAM)
        </span>
      </p>
    </div>
  );
}

function MemoryCell({
  address,
  machine,
  isPc,
  isAccessed,
  isChanged,
}: {
  address: number;
  machine: MachineState;
  isPc: boolean;
  isAccessed: boolean;
  isChanged: boolean;
}) {
  if (isIoAddress(address)) {
    const device = deviceAt(address);
    const value = readIo(machine.io, address);
    return (
      <td
        className={`px-1 py-0.5 text-center italic ${isAccessed ? "bg-active text-active-fg" : "text-ink-muted"}`}
        title={device ? `${toHex(address, 2)}: ${device.name} = ${value}` : `${toHex(address, 2)}: sem dispositivo`}
      >
        {device ? device.name.slice(0, 4) : "—"}
      </td>
    );
  }

  const word = machine.memory[address];
  const classes = [
    "px-1 py-0.5 text-center",
    isAccessed ? "bg-active text-active-fg font-bold" : isChanged ? "bg-marker text-marker-ink" : word === 0 ? "text-ink-muted" : "",
    isPc ? "outline-2 -outline-offset-2 outline-ink" : "",
  ].join(" ");
  const label = [`${toHex(address, 2)} = ${toHex(word, 4)} (${word})`, isPc && "PC", isAccessed && "acessado", isChanged && "alterado"]
    .filter(Boolean)
    .join(", ");

  return (
    <td className={classes} title={label} aria-label={label}>
      {toHex(word, 4).slice(2)}
    </td>
  );
}
