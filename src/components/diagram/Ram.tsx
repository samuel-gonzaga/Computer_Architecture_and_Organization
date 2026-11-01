import { toHex } from "@/core/isa";
import { IO_REGION_START, type Memory } from "@/core/memory";
import type { Address } from "@/core/types";
import { BOX } from "./layout";
import { Block, Caption, Value } from "./parts";

type Props = {
  memory: Memory;
  pc: Address;
  focus?: Address; // endereço no barramento nesta microetapa
  active: boolean;
  changed: ReadonlySet<string>;
};

const ROWS = 12;
const ROW_HEIGHT = 28;

/** RAM: uma janela de 12 palavras em torno do endereço acessado (ou do PC). */
export function Ram({ memory, pc, focus, active, changed }: Props) {
  const { x, y, w } = BOX.RAM;
  const target = focus !== undefined && focus < IO_REGION_START ? focus : pc;
  const start = Math.min(Math.max(target - 5, 0), IO_REGION_START - ROWS);
  const top = y + 66;

  return (
    <Block id="RAM" label="Memória principal (RAM)" box={BOX.RAM} active={active}>
      <Caption x={x + 12} y={y + 22}>
        Memória principal
      </Caption>
      <text className="dg-text dg-muted" x={x + 12} y={y + 40} fontSize={11}>
        RAM · 256 palavras de 16 bits
      </text>
      {Array.from({ length: ROWS }, (_, row) => {
        const address = start + row;
        const rowY = top + row * ROW_HEIGHT;
        const accessed = active && address === focus;
        return (
          <g key={address} className="dg-ram-row" data-current={accessed}>
            <rect x={x + 6} y={rowY} width={w - 12} height={ROW_HEIGHT - 4} rx={3} />
            <text className="dg-text dg-muted dg-mono" x={x + 14} y={rowY + 17} fontSize={12}>
              {toHex(address, 2)}
            </text>
            <Value x={x + 62} y={rowY + 18} text={toHex(memory[address], 4)} changed={changed.has(`M[${toHex(address, 2)}]`)} size={14} />
            {address === pc && (
              <text className="dg-text dg-pc-marker dg-mono" x={x + w - 14} y={rowY + 17} fontSize={11} textAnchor="end">
                ◀ PC
              </text>
            )}
          </g>
        );
      })}
    </Block>
  );
}
