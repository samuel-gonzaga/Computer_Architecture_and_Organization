import { toHex } from "@/core/isa";
import type { ComponentId, Word } from "@/core/types";
import { BOX } from "./layout";
import { Caption, Value } from "./parts";

type Props = {
  registers: readonly [Word, Word, Word, Word];
  components: ReadonlySet<ComponentId>;
  changed: ReadonlySet<string>;
};

const ROW_HEIGHT = 44;

/** Banco de registradores de uso geral R0–R3; cada um acende individualmente. */
export function RegisterFile({ registers, components, changed }: Props) {
  const { x, y, w, h } = BOX.REGISTERS;
  return (
    <g aria-label="Banco de registradores">
      <rect className="dg-frame" x={x} y={y} width={w} height={h} rx={6} />
      <Caption x={x + 12} y={y + 20}>
        Registradores
      </Caption>
      {registers.map((value, index) => {
        const id = `R${index}` as ComponentId;
        const top = y + 30 + index * ROW_HEIGHT;
        const active = components.has(id);
        return (
          <g key={id} data-component={id} data-active={active} role="group" aria-label={active ? `${id} (ativo)` : id}>
            <title>{`Registrador ${id} = ${value}`}</title>
            <rect className="dg-box" x={x + 8} y={top} width={w - 16} height={ROW_HEIGHT - 6} rx={4} />
            <text className="dg-text dg-title" x={x + 20} y={top + 26} fontSize={16}>
              {id}
            </text>
            <Value x={x + 64} y={top + 26} text={toHex(value, 4)} changed={changed.has(id)} size={18} />
            <text className="dg-text dg-muted dg-mono" x={x + w - 20} y={top + 26} fontSize={12} textAnchor="end">
              {value}
            </text>
          </g>
        );
      })}
    </g>
  );
}
