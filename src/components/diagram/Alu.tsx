import type { Flags } from "@/core/types";
import { BOX } from "./layout";
import { Caption } from "./parts";

type Props = {
  active: boolean;
  operation?: string; // mnemônico da operação em curso, ex.: "ADD"
};

/** ULA no formato clássico em "V", com as entradas A e B no topo e a saída embaixo. */
export function Alu({ active, operation }: Props) {
  const { x, y, w, h } = BOX.ALU;
  const mid = x + w / 2;
  const points = [
    [x, y],
    [mid - 20, y],
    [mid, y + 32],
    [mid + 20, y],
    [x + w, y],
    [x + w - 48, y + h],
    [x + 48, y + h],
  ]
    .map(([px, py]) => `${px},${py}`)
    .join(" ");

  return (
    <g data-component="ALU" data-active={active} role="group" aria-label={active ? "ULA (ativa)" : "ULA"}>
      <title>ULA — Unidade Lógica e Aritmética</title>
      <polygon className="dg-box" points={points} />
      <text className="dg-text dg-caption" x={x + 56} y={y + 22} textAnchor="middle">
        A
      </text>
      <text className="dg-text dg-caption" x={x + w - 56} y={y + 22} textAnchor="middle">
        B
      </text>
      <text className="dg-text dg-title" x={mid} y={y + 74} textAnchor="middle">
        ULA
      </text>
      <text className="dg-text dg-mono" x={mid} y={y + 96} fontSize={13} textAnchor="middle">
        {active && operation ? `ALU_OP = ${operation}` : "16 bits"}
      </text>
    </g>
  );
}

type FlagsProps = {
  active: boolean;
  flags: Flags;
  changed: ReadonlySet<string>;
};

const FLAG_NAMES: { key: keyof Flags; title: string }[] = [
  { key: "Z", title: "zero" },
  { key: "N", title: "negativo" },
  { key: "C", title: "carry/borrow" },
  { key: "V", title: "overflow" },
];

/** Registrador de flags: cada flag mostra o bit (0/1) e fica preenchida quando vale 1. */
export function FlagsRegister({ active, flags, changed }: FlagsProps) {
  const { x, y, w, h } = BOX.FLAGS;
  const cell = (w - 64) / 4;
  return (
    <g data-component="FLAGS" data-active={active} role="group" aria-label={active ? "FLAGS (ativo)" : "FLAGS"}>
      <title>Registrador de flags (Z, N, C, V)</title>
      <rect className="dg-box" x={x} y={y} width={w} height={h} rx={6} />
      <Caption x={x + 12} y={y + 30}>
        FLAGS
      </Caption>
      {FLAG_NAMES.map(({ key, title }, i) => {
        const cx = x + 64 + i * cell;
        const set = flags[key];
        return (
          <g key={key} className="dg-flag" data-set={set} data-changed={changed.has(`FLAGS.${key}`)}>
            <title>{`${key} (${title}) = ${set ? 1 : 0}`}</title>
            <rect x={cx + 4} y={y + 8} width={cell - 8} height={h - 16} rx={4} />
            <text className="dg-mono" x={cx + cell / 2} y={y + h / 2 + 5} fontSize={14} textAnchor="middle">
              {`${key}=${set ? 1 : 0}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
