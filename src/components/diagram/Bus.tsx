"use client";

import { motion, useReducedMotion } from "framer-motion";
import { toHex } from "@/core/isa";
import type { ComponentId } from "@/core/types";
import type { BusHighlight } from "./highlights";
import { BUS_X, BUS_Y, TAPS, tapAnchorY, type BusId, type Endpoint } from "./layout";

const BUS_INFO: Record<BusId, { label: string; digits: number }> = {
  address: { label: "Barramento de endereços · 8 bits", digits: 2 },
  data: { label: "Barramento de dados · 16 bits", digits: 4 },
  control: { label: "Barramento de controle", digits: 0 },
};

const ENDPOINTS = Object.keys(TAPS) as Endpoint[];

type Props = {
  bus: BusId;
  highlight: BusHighlight;
  components: ReadonlySet<ComponentId>;
  animationKey: number; // muda a cada microetapa e reinicia a animação do valor
};

/**
 * Um barramento do sistema: linha com cor, rótulo e padrão de traço próprios,
 * as derivações de cada componente e, quando ativo, o trecho em uso com o
 * valor transmitido "viajando" da origem ao destino.
 */
export function Bus({ bus, highlight, components, animationKey }: Props) {
  const reduceMotion = useReducedMotion();
  const y = BUS_Y[bus];
  const { from, to, active, broadcast } = highlight;
  const fromX = TAPS[from][bus];
  const toX = TAPS[to][bus];
  const [left, right] = broadcast ? [BUS_X.start, BUS_X.end] : [Math.min(fromX, toX), Math.max(fromX, toX)];

  const tapActive = (endpoint: Endpoint) => {
    if (!active) return false;
    if (broadcast || endpoint === from || endpoint === to) return true;
    const x = TAPS[endpoint][bus];
    return components.has(endpoint as ComponentId) && x >= left && x <= right;
  };

  const text =
    highlight.label ??
    (bus === "control"
      ? highlight.signals.join(" · ")
      : highlight.value !== undefined
        ? toHex(highlight.value, BUS_INFO[bus].digits)
        : "");
  const pillWidth = text.length * 8.2 + 20;
  const direction = toX >= fromX ? 1 : -1;

  return (
    <g data-bus={bus} data-active={active} role="group" aria-label={`${BUS_INFO[bus].label}${active ? `: ${text}` : ""}`}>
      <title>{BUS_INFO[bus].label}</title>
      <text className="dg-bus-label" data-bus={bus} x={BUS_X.start + 8} y={y - 10}>
        {BUS_INFO[bus].label}
      </text>
      <line className="dg-bus" data-bus={bus} x1={BUS_X.start} y1={y} x2={BUS_X.end} y2={y} />

      {ENDPOINTS.map((endpoint) => {
        const x = TAPS[endpoint][bus];
        // A derivação de controle da CPU começa na UC (desenhada pela CPU).
        const anchorY = tapAnchorY(endpoint);
        return (
          <g key={endpoint} className="dg-tap-group" data-active={tapActive(endpoint)}>
            <line className="dg-tap" data-bus={bus} x1={x} y1={anchorY} x2={x} y2={y} />
            <circle className="dg-junction" data-bus={bus} cx={x} cy={y} r={4} />
          </g>
        );
      })}

      {active && (
        <>
          <line className="dg-bus-active" data-bus={bus} x1={left} y1={y} x2={right} y2={y} />
          {!broadcast && from !== to && (
            <polygon
              className="dg-bus-arrow"
              data-bus={bus}
              points={`${toX - direction * 12},${y - 8} ${toX},${y} ${toX - direction * 12},${y + 8}`}
            />
          )}
          {text && (
            <motion.g
              key={animationKey}
              className="dg-bus-pill"
              data-bus={bus}
              initial={{ x: reduceMotion || broadcast ? (fromX + toX) / 2 : fromX }}
              animate={{ x: broadcast ? (fromX + toX) / 2 : from === to ? fromX : (fromX + toX) / 2 }}
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
            >
              <rect x={-pillWidth / 2} y={y - 13} width={pillWidth} height={26} rx={13} />
              <text className="dg-mono" x={0} y={y + 5} fontSize={13} textAnchor="middle">
                {text}
              </text>
            </motion.g>
          )}
        </>
      )}
    </g>
  );
}
