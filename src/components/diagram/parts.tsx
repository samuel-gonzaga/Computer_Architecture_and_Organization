// Peças reutilizadas pelos blocos do diagrama.

import type { ReactNode } from "react";
import { toHex } from "@/core/isa";
import type { Box } from "./layout";

type BlockProps = {
  id: string; // ComponentId, usado em data-component
  label: string; // nome acessível em português
  box: Box;
  active: boolean;
  children?: ReactNode;
};

/** Bloco retangular que "acende" (cores invertidas) quando o componente está ativo. */
export function Block({ id, label, box, active, children }: BlockProps) {
  return (
    <g data-component={id} data-active={active} role="group" aria-label={active ? `${label} (ativo)` : label}>
      <title>{label}</title>
      <rect className="dg-box" x={box.x} y={box.y} width={box.w} height={box.h} rx={6} />
      {children}
    </g>
  );
}

type ValueProps = {
  x: number;
  y: number;
  text: string;
  changed?: boolean;
  size?: number;
  anchor?: "start" | "middle" | "end";
};

/** Valor em fonte mono; quando acabou de mudar, ganha uma marca de "marca-texto". */
export function Value({ x, y, text, changed = false, size = 18, anchor = "start" }: ValueProps) {
  const width = text.length * size * 0.62 + 8;
  const left = anchor === "start" ? x - 4 : anchor === "middle" ? x - width / 2 : x - width + 4;
  return (
    <g data-changed={changed}>
      {changed && <rect className="dg-changed" x={left} y={y - size * 0.86} width={width} height={size * 1.18} rx={3} />}
      <text className="dg-text dg-mono dg-value" x={x} y={y} fontSize={size} textAnchor={anchor}>
        {text}
      </text>
    </g>
  );
}

/** Rótulo pequeno em caixa alta. */
export function Caption({ x, y, children, anchor = "start" }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }) {
  return (
    <text className="dg-text dg-caption" x={x} y={y} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** Registrador com nome, valor em hexadecimal e valor decimal. */
export function RegisterBox({
  id,
  label,
  box,
  value,
  digits,
  active,
  changed,
}: {
  id: string;
  label: string;
  box: Box;
  value: number;
  digits: number;
  active: boolean;
  changed: boolean;
}) {
  return (
    <Block id={id} label={`Registrador ${label}`} box={box} active={active}>
      <Caption x={box.x + 12} y={box.y + 22}>
        {label}
      </Caption>
      <text className="dg-text dg-muted dg-mono" x={box.x + box.w - 12} y={box.y + 22} fontSize={12} textAnchor="end">
        {value}
      </text>
      <Value x={box.x + 12} y={box.y + box.h - 16} text={toHex(value, digits)} changed={changed} size={digits > 2 ? 20 : 22} />
    </Block>
  );
}
