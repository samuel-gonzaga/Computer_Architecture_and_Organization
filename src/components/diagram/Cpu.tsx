import type { MachineState, MicroStep } from "@/core/types";
import { Alu, FlagsRegister } from "./Alu";
import { ControlUnit } from "./ControlUnit";
import type { DiagramHighlights } from "./highlights";
import { BOX, TAPS } from "./layout";
import { RegisterBox } from "./parts";
import { RegisterFile } from "./RegisterFile";

type Props = {
  state: MachineState;
  micro?: MicroStep;
  highlights: DiagramHighlights;
};

/** CPU: Unidade de Controle, ULA, flags, registradores de uso geral e especiais. */
export function Cpu({ state, micro, highlights }: Props) {
  const { components, changed } = highlights;
  const cpu = BOX.CPU;
  const uc = BOX.CONTROL_UNIT;
  const controlX = TAPS.CPU.control;
  const operation = micro?.instruction?.split(" ")[0];

  return (
    <g aria-label="CPU">
      <rect className="dg-cpu" x={cpu.x} y={cpu.y} width={cpu.w} height={cpu.h} rx={10} />
      <text className="dg-text dg-title" x={cpu.x + 20} y={cpu.y + 28}>
        CPU
      </text>
      <text className="dg-text dg-caption" x={cpu.x + 80} y={cpu.y + 27}>
        NeoCore-8 · Von Neumann + RISC
      </text>

      {/* Linha de controle: da UC até o barramento de controle, entre os dois grupos de registradores. */}
      <path
        className="dg-tap"
        data-bus="control"
        data-active={highlights.control.active}
        d={`M${uc.x + uc.w} ${uc.y + 100} H${controlX} V${BOX.MAR.y + BOX.MAR.h}`}
      />

      <ControlUnit
        active={components.has("CONTROL_UNIT")}
        phase={micro?.phase}
        instruction={micro?.instruction}
        internalSignals={highlights.internalSignals}
        clock={highlights.clock}
      />
      <Alu active={components.has("ALU")} operation={operation} />
      <FlagsRegister active={components.has("FLAGS")} flags={state.flags} changed={changed} />
      <RegisterFile registers={state.registers} components={components} changed={changed} />

      <RegisterBox id="PC" label="PC" box={BOX.PC} value={state.pc} digits={2} active={components.has("PC")} changed={changed.has("PC")} />
      <RegisterBox id="IR" label="IR" box={BOX.IR} value={state.ir} digits={4} active={components.has("IR")} changed={changed.has("IR")} />
      <RegisterBox id="MAR" label="MAR" box={BOX.MAR} value={state.mar} digits={2} active={components.has("MAR")} changed={changed.has("MAR")} />
      <RegisterBox id="MDR" label="MDR" box={BOX.MDR} value={state.mdr} digits={4} active={components.has("MDR")} changed={changed.has("MDR")} />
    </g>
  );
}
