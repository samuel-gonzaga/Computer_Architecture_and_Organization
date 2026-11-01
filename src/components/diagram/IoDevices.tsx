import { toHex } from "@/core/isa";
import type { ComponentId, IoDevices as IoState } from "@/core/types";
import { BOX } from "./layout";
import { Block, Caption, Value } from "./parts";

type Props = {
  io: IoState;
  components: ReadonlySet<ComponentId>;
  changed: ReadonlySet<string>;
};

/** Dispositivos de E/S mapeados em memória: teclado (0xF0), display (0xF1) e LED (0xF2). */
export function IoDevices({ io, components, changed }: Props) {
  const keyboard = BOX.KEYBOARD;
  const display = BOX.DISPLAY;
  const led = BOX.LED;
  const ledOn = io.led !== 0;

  return (
    <g aria-label="Dispositivos de E/S">
      <Block id="KEYBOARD" label="Teclado (entrada, 0xF0)" box={keyboard} active={components.has("KEYBOARD")}>
        <Caption x={keyboard.x + 12} y={keyboard.y + 22}>
          Teclado
        </Caption>
        <text className="dg-text dg-muted dg-mono" x={keyboard.x + 12} y={keyboard.y + 40} fontSize={11}>
          0xF0 · entrada
        </text>
        <g className="dg-keys">
          {[0, 1, 2, 3, 4].map((key) => (
            <rect key={key} x={keyboard.x + 12 + key * 20} y={keyboard.y + 66} width={16} height={14} rx={2} />
          ))}
        </g>
        <Value x={keyboard.x + keyboard.w - 14} y={keyboard.y + 82} text={String(io.keyboard)} size={26} anchor="end" />
      </Block>

      <Block id="DISPLAY" label="Display (saída, 0xF1)" box={display} active={components.has("DISPLAY")}>
        <Caption x={display.x + 12} y={display.y + 22}>
          Display
        </Caption>
        <text className="dg-text dg-muted dg-mono" x={display.x + 12} y={display.y + 40} fontSize={11}>
          0xF1 · saída
        </text>
        <rect className="dg-screen" x={display.x + 12} y={display.y + 50} width={display.w - 24} height={42} rx={4} />
        <g data-changed={changed.has("DISPLAY")}>
          <text className="dg-screen-digits dg-mono" x={display.x + display.w - 24} y={display.y + 83} fontSize={28} textAnchor="end">
            {String(io.display).padStart(5, " ")}
          </text>
        </g>
      </Block>

      <Block id="LED" label="LED de status (saída, 0xF2)" box={led} active={components.has("LED")}>
        <Caption x={led.x + 12} y={led.y + 22}>
          LED
        </Caption>
        <text className="dg-text dg-muted dg-mono" x={led.x + 12} y={led.y + 40} fontSize={11}>
          0xF2 · saída
        </text>
        <circle className="dg-led" data-on={ledOn} cx={led.x + 30} cy={led.y + 70} r={14} />
        <text className="dg-text dg-mono" x={led.x + 56} y={led.y + 66} fontSize={12}>
          {ledOn ? "aceso" : "apagado"}
        </text>
        <Value x={led.x + 56} y={led.y + 86} text={toHex(io.led, 4)} changed={changed.has("LED")} size={14} />
      </Block>
    </g>
  );
}
