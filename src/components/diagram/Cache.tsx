import { toHex } from "@/core/isa";
import type { CacheEventType, CacheState } from "@/core/types";
import { BOX } from "./layout";
import { Block, Caption } from "./parts";

type Props = {
  cache: CacheState;
  active: boolean;
  event?: { type: CacheEventType; index: number };
};

const ROW_HEIGHT = 26;

/** Cache L1: as 8 linhas (validade, tag, dado) e o evento da microetapa atual. */
export function Cache({ cache, active, event }: Props) {
  const { x, y, w } = BOX.CACHE;
  const top = y + 74;
  return (
    <Block id="CACHE" label="Cache L1" box={BOX.CACHE} active={active}>
      <Caption x={x + 12} y={y + 22}>
        Cache L1
      </Caption>
      <text className="dg-text dg-muted" x={x + 12} y={y + 40} fontSize={11}>
        mapeamento direto · 8 linhas
      </text>
      {event && (
        <g className="dg-badge" data-event={event.type}>
          <rect x={x + w - 74} y={y + 10} width={62} height={20} rx={10} />
          <text className="dg-mono" x={x + w - 43} y={y + 24} fontSize={11} textAnchor="middle">
            {event.type}
          </text>
        </g>
      )}
      <text className="dg-text dg-muted dg-mono" y={top - 8} fontSize={10}>
        <tspan x={x + 12}>i</tspan>
        <tspan x={x + 30}>V</tspan>
        <tspan x={x + 52}>tag</tspan>
        <tspan x={x + 96}>dado</tspan>
      </text>
      {cache.lines.map((line, index) => {
        const rowY = top + index * ROW_HEIGHT;
        const current = event !== undefined && event.type !== "BYPASS" && event.index === index;
        return (
          <g key={index} className="dg-cache-row" data-current={current} data-valid={line.valid}>
            <title>{`Linha ${index}: ${line.valid ? `tag ${toHex(line.tag, 2)}, dado ${toHex(line.data, 4)}` : "vazia"}`}</title>
            <rect x={x + 6} y={rowY} width={w - 12} height={ROW_HEIGHT - 4} rx={3} />
            <text className="dg-text dg-mono" y={rowY + 16} fontSize={12}>
              <tspan x={x + 12}>{index}</tspan>
              <tspan x={x + 30}>{line.valid ? 1 : 0}</tspan>
              <tspan x={x + 52}>{line.valid ? toHex(line.tag, 2) : "--"}</tspan>
              <tspan x={x + 96}>{line.valid ? toHex(line.data, 4) : "------"}</tspan>
            </text>
          </g>
        );
      })}
    </Block>
  );
}
