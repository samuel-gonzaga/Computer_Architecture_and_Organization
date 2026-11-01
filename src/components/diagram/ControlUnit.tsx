import type { ControlSignal, Phase } from "@/core/types";
import { BOX } from "./layout";
import { Block, Caption } from "./parts";

const PHASE_LABEL: Record<Phase, string> = {
  BOOT: "CARGA",
  FETCH: "BUSCA",
  DECODE: "DECODIFICAÇÃO",
  EXECUTE: "EXECUÇÃO",
  HALT: "PARADA",
};

type Props = {
  active: boolean;
  phase?: Phase;
  instruction?: string;
  internalSignals: readonly ControlSignal[];
  clock: boolean;
};

/** Unidade de Controle: fase atual, instrução decodificada, sinais internos e pulso de clock. */
export function ControlUnit({ active, phase, instruction, internalSignals, clock }: Props) {
  const box = BOX.CONTROL_UNIT;
  const chips = internalSignals.reduce<{ signal: ControlSignal; x: number; width: number }[]>((placed, signal) => {
    const previous = placed[placed.length - 1];
    const x = previous ? previous.x + previous.width + 6 : box.x + 12;
    return [...placed, { signal, x, width: signal.length * 7.4 + 14 }];
  }, []);
  return (
    <Block id="CONTROL_UNIT" label="Unidade de Controle" box={box} active={active}>
      <Caption x={box.x + 12} y={box.y + 22}>
        Unidade de Controle
      </Caption>
      <ClockPulse x={box.x + box.w - 56} y={box.y + 10} on={clock} />
      <text className="dg-text dg-phase" x={box.x + 12} y={box.y + 56}>
        {phase ? PHASE_LABEL[phase] : "—"}
      </text>
      <text className="dg-text dg-mono" x={box.x + 12} y={box.y + 80} fontSize={14}>
        {instruction ?? " "}
      </text>
      {chips.map(({ signal, x, width }) => (
        <g key={signal} className="dg-chip">
          <rect x={x} y={box.y + 96} width={width} height={22} rx={11} />
          <text className="dg-mono" x={x + width / 2} y={box.y + 111} fontSize={11} textAnchor="middle">
            {signal}
          </text>
        </g>
      ))}
    </Block>
  );
}

/** Onda quadrada que acende a cada pulso de clock. */
function ClockPulse({ x, y, on }: { x: number; y: number; on: boolean }) {
  return (
    <g className="dg-clock" data-on={on} aria-label={on ? "clock: pulso" : "clock parado"}>
      <path d={`M${x} ${y + 16} h8 v-12 h10 v12 h10 v-12 h10 v12 h6`} />
      <text className="dg-mono" x={x + 22} y={y + 30} fontSize={9} textAnchor="middle">
        CLOCK
      </text>
    </g>
  );
}
