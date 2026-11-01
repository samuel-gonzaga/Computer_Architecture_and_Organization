import { BOX } from "./layout";
import { Block, Caption } from "./parts";

type Props = {
  programSize: number;
  active: boolean;
};

/** Armazenamento: o disco guarda o programa que o loader copia para a RAM no boot. */
export function Disk({ programSize, active }: Props) {
  const { x, y, w } = BOX.DISK;
  const cx = x + w / 2;
  return (
    <Block id="DISK" label="Disco (armazenamento)" box={BOX.DISK} active={active}>
      <Caption x={x + 12} y={y + 22}>
        Disco
      </Caption>
      <g className="dg-disk-icon">
        <path d={`M${cx - 34} ${y + 46} v44 a34 10 0 0 0 68 0 v-44`} />
        <ellipse cx={cx} cy={y + 46} rx={34} ry={10} />
        <path d={`M${cx - 34} ${y + 68} a34 10 0 0 0 68 0`} />
      </g>
      <text className="dg-text dg-mono" x={cx} y={y + 128} fontSize={12} textAnchor="middle">
        {`programa · ${programSize} pal.`}
      </text>
    </Block>
  );
}
