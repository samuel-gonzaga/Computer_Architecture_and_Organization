import { splitAddress } from "@/core/cache";
import { toHex } from "@/core/isa";
import type { MachineState, MicroStep } from "@/core/types";
type Props = {
  machine: MachineState;
  micro?: MicroStep;
};

const bits = (value: number, width: number) => value.toString(2).padStart(width, "0");

const EVENT_LABEL ={ HIT: "HIT (acerto)", MISS: "MISS (falta)", WRITE: "WRITE (escrita)", BYPASS: "BYPASS (E/S)" } as const;

/** Cache: as 8 linhas (válido, tag, dado, último evento) e como o endereço atual se divide. */
export function CachePanel({ machine, micro }: Props) {
  const event = micro?.cache;
  const address = micro?.buses.address;

  return (
    <div className="flex flex-col gap-4">
      {event && address !== undefined ? (
        <div className="rounded-md border border-line p-3 text-sm">
          <p className="mb-1 font-semibold">
            Acesso a {toHex(address, 2)}: {EVENT_LABEL[event.type]}
          </p>
          <p className="font-mono">
            {bits(address, 8)} = <span className="text-field-op">tag {bits(splitAddress(address).tag, 5)}</span> |{" "}
            <span className="text-field-rd">índice {bits(splitAddress(address).index, 3)}</span>
          </p>
          <p className="text-ink-muted">
            {event.type === "BYPASS"
              ? "A região de E/S não é cacheável: o acesso vai direto ao dispositivo."
              : `O índice escolhe a linha ${event.index}; a tag (${toHex(event.tag, 2)}) diz qual endereço ela guarda.`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          Mapeamento direto: endereço de 8 bits = tag (5 bits) | índice (3 bits). Write-through, sem alocação na escrita.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Linhas da cache L1</caption>
          <thead className="text-ink-muted">
            <tr>
              <th scope="col" className="px-2 py-1 font-normal">Linha</th>
              <th scope="col" className="px-2 py-1 font-normal">Válido</th>
              <th scope="col" className="px-2 py-1 font-normal">Tag</th>
              <th scope="col" className="px-2 py-1 font-normal">Endereço</th>
              <th scope="col" className="px-2 py-1 font-normal">Dado</th>
              <th scope="col" className="px-2 py-1 font-normal">Último evento</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {machine.cache.lines.map((line, index) => {
              const current = event !== undefined && event.type !== "BYPASS" && event.index === index;
              return (
                <tr
                  key={index}
                  aria-current={current ? "true" : undefined}
                  className={`border-t border-line ${current ? "bg-active text-active-fg" : line.valid ? "" : "text-ink-muted"}`}
                >
                  <td className="px-2 py-1">{index}</td>
                  <td className="px-2 py-1">{line.valid ? "1" : "0"}</td>
                  <td className="px-2 py-1">{line.valid ? toHex(line.tag, 2) : "—"}</td>
                  <td className="px-2 py-1">{line.valid ? toHex((line.tag << 3) | index, 2) : "—"}</td>
                  <td className="px-2 py-1">{line.valid ? toHex(line.data, 4) : "—"}</td>
                  <td className="px-2 py-1">{line.lastEvent ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
