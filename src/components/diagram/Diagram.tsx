"use client";

import type { Ref } from "react";
import type { MachineState, MicroStep } from "@/core/types";
import { Bus } from "./Bus";
import { Cache } from "./Cache";
import { Cpu } from "./Cpu";
import { Disk } from "./Disk";
import { highlightsFor } from "./highlights";
import { IoDevices } from "./IoDevices";
import { BOX, VIEW, type BusId } from "./layout";
import { Caption } from "./parts";
import { Ram } from "./Ram";

type Props = {
  state: MachineState;
  micro?: MicroStep; // última microetapa executada; define o que acende
  svgRef?: Ref<SVGSVGElement>;
};

const BUSES: BusId[] = ["address", "data", "control"];

/** Diagrama geral da arquitetura NeoCore-8 (SVG). Renderiza exatamente o que a MicroStep descreve. */
export function Diagram({ state, micro, svgRef }: Props) {
  const highlights = highlightsFor(micro);
  const { components, changed } = highlights;
  const animationKey = micro?.cycle ?? -1;

  return (
    <svg
      ref={svgRef}
      className="dg-root"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-labelledby="dg-title dg-desc"
    >
      <title id="dg-title">Diagrama da arquitetura NeoCore-8</title>
      <desc id="dg-desc">
        {micro ? `${micro.title}. ${micro.explanation}` : "Máquina pronta para o boot."}
      </desc>
      <defs>
        <pattern id="dg-grid" width={16} height={16} patternUnits="userSpaceOnUse">
          <path className="dg-grid-line" d="M16 0H0V16" />
        </pattern>
      </defs>
      <rect className="dg-paper" width={VIEW.width} height={VIEW.height} />
      <rect width={VIEW.width} height={VIEW.height} fill="url(#dg-grid)" />

      <Cpu state={state} micro={micro} highlights={highlights} />
      <Cache cache={state.cache} active={components.has("CACHE")} event={highlights.cache} />
      <Ram
        memory={state.memory}
        pc={state.pc}
        focus={micro?.buses.address}
        active={components.has("RAM")}
        changed={changed}
      />
      <Disk programSize={state.disk.length} active={components.has("DISK")} />
      <Legend />
      <IoDevices io={state.io} components={components} changed={changed} />

      {BUSES.map((bus) => (
        <Bus key={bus} bus={bus} highlight={highlights[bus]} components={components} animationKey={animationKey} />
      ))}
    </svg>
  );
}

/** Legenda: cor, padrão de traço e rótulo de cada barramento, e os estados visuais. */
function Legend() {
  const { x, y, w, h } = BOX.LEGEND;
  const rows: { bus: BusId; label: string }[] = [
    { bus: "address", label: "Endereços" },
    { bus: "data", label: "Dados" },
    { bus: "control", label: "Controle" },
  ];
  return (
    <g aria-label="Legenda">
      <rect className="dg-frame" x={x} y={y} width={w} height={h} rx={6} />
      <Caption x={x + 12} y={y + 22}>
        Legenda
      </Caption>
      {rows.map(({ bus, label }, i) => (
        <g key={bus}>
          <line className="dg-bus-active" data-bus={bus} x1={x + 16} y1={y + 44 + i * 22} x2={x + 60} y2={y + 44 + i * 22} />
          <text className="dg-text" x={x + 72} y={y + 48 + i * 22} fontSize={13}>
            {label}
          </text>
        </g>
      ))}
      <g data-active="true">
        <rect className="dg-box" x={x + 200} y={y + 32} width={40} height={22} rx={4} />
      </g>
      <text className="dg-text" x={x + 252} y={y + 48} fontSize={13}>
        componente ativo
      </text>
      <rect className="dg-changed" x={x + 200} y={y + 64} width={40} height={22} rx={4} />
      <text className="dg-text" x={x + 252} y={y + 80} fontSize={13}>
        valor alterado
      </text>
      <text className="dg-text dg-muted" x={x + 400} y={y + 48} fontSize={12}>
        Valores em hexadecimal;
      </text>
      <text className="dg-text dg-muted" x={x + 400} y={y + 66} fontSize={12}>
        o decimal aparece ao lado.
      </text>
    </g>
  );
}
