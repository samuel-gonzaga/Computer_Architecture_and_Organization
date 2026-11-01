// Dispositivos de E/S mapeados em memória (§4.2): teclado, display e LED.
// A CPU os acessa com LOAD/STORE comuns; a máquina desvia para cá todo
// acesso aos endereços 0xF0–0xFF, que não são RAM.

import { isWord } from "./isa";
import { IO_ADDRESS } from "./memory";
import type { Address, ComponentId, IoDevices, Word } from "./types";

export type IoDevice = {
  readonly address: Address;
  readonly component: ComponentId;
  readonly name: string; // nome usado nas explicações, ex.: "o teclado"
  readonly direction: "input" | "output";
};

export const IO_DEVICES: readonly IoDevice[] = [
  { address: IO_ADDRESS.KEYBOARD, component: "KEYBOARD", name: "teclado", direction: "input" },
  { address: IO_ADDRESS.DISPLAY, component: "DISPLAY", name: "display", direction: "output" },
  { address: IO_ADDRESS.LED, component: "LED", name: "LED", direction: "output" },
];

/** Dispositivo ligado ao endereço; `undefined` se não houver nenhum. */
export function deviceAt(address: Address): IoDevice | undefined {
  return IO_DEVICES.find((device) => device.address === address);
}

export function createIo(keyboard: Word = 0): IoDevices {
  return setKeyboard({ keyboard: 0, display: 0, led: 0 }, keyboard);
}

/** Valor que o dispositivo coloca no barramento de dados. Sem dispositivo, o barramento fica em 0. */
export function readIo(io: IoDevices, address: Address): Word {
  switch (address) {
    case IO_ADDRESS.KEYBOARD:
      return io.keyboard;
    case IO_ADDRESS.DISPLAY:
      return io.display;
    case IO_ADDRESS.LED:
      return io.led;
    default:
      return 0;
  }
}

/** Entrega o valor ao dispositivo. O teclado (só entrada) e endereços sem dispositivo ignoram a escrita. */
export function writeIo(io: IoDevices, address: Address, value: Word): IoDevices {
  switch (address) {
    case IO_ADDRESS.DISPLAY:
      return { ...io, display: value };
    case IO_ADDRESS.LED:
      return { ...io, led: value };
    default:
      return io;
  }
}

/** Valor digitado pelo usuário no teclado (lido em 0xF0). */
export function setKeyboard(io: IoDevices, value: Word): IoDevices {
  if (!isWord(value)) {
    throw new RangeError(`Entrada do teclado fora de 16 bits: ${value}`);
  }
  return { ...io, keyboard: value };
}
