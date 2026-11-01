// Geometria do diagrama (coordenadas do viewBox do SVG).
//
// Os três barramentos do sistema correm na horizontal. Acima deles ficam CPU,
// cache, RAM e disco; abaixo, os dispositivos de E/S. Cada componente se liga
// aos barramentos por "derivações" (taps) verticais.

export const VIEW = { width: 1200, height: 760 } as const;

export type BusId = "address" | "data" | "control";

/** Pontas de um barramento: a CPU e os componentes externos a ela. */
export type Endpoint = "CPU" | "CACHE" | "KEYBOARD" | "RAM" | "DISPLAY" | "DISK" | "LED";

export const BUS_Y: Record<BusId, number> = { address: 500, data: 548, control: 596 };
export const BUS_X = { start: 16, end: 1184 } as const;

/** Posição horizontal de cada derivação, por componente e barramento (da esquerda para a direita). */
export const TAPS: Record<Endpoint, Record<BusId, number>> = {
  CPU: { address: 394, data: 532, control: 308 },
  CACHE: { address: 670, data: 694, control: 718 },
  KEYBOARD: { address: 746, data: 770, control: 794 },
  RAM: { address: 850, data: 874, control: 898 },
  DISPLAY: { address: 930, data: 954, control: 978 },
  DISK: { address: 1060, data: 1084, control: 1108 },
  LED: { address: 1124, data: 1148, control: 1172 },
};

export type Box = { x: number; y: number; w: number; h: number };

export const BOX = {
  CPU: { x: 16, y: 16, w: 600, h: 420 },
  CONTROL_UNIT: { x: 36, y: 56, w: 250, h: 132 },
  ALU: { x: 330, y: 60, w: 266, h: 112 },
  FLAGS: { x: 330, y: 192, w: 266, h: 50 },
  REGISTERS: { x: 36, y: 204, w: 250, h: 212 },
  PC: { x: 330, y: 256, w: 128, h: 70 },
  IR: { x: 468, y: 256, w: 128, h: 70 },
  MAR: { x: 330, y: 340, w: 128, h: 76 },
  MDR: { x: 468, y: 340, w: 128, h: 76 },
  CACHE: { x: 646, y: 96, w: 168, h: 312 },
  RAM: { x: 834, y: 16, w: 180, h: 420 },
  DISK: { x: 1034, y: 16, w: 150, h: 150 },
  LEGEND: { x: 16, y: 644, w: 610, h: 100 },
  KEYBOARD: { x: 646, y: 644, w: 168, h: 100 },
  DISPLAY: { x: 834, y: 644, w: 180, h: 100 },
  LED: { x: 1034, y: 644, w: 150, h: 100 },
} satisfies Record<string, Box>;

/** Onde cada derivação encosta no componente (borda inferior acima dos barramentos, superior abaixo). */
export function tapAnchorY(endpoint: Endpoint): number {
  switch (endpoint) {
    case "CPU":
      return BOX.MAR.y + BOX.MAR.h;
    case "KEYBOARD":
    case "DISPLAY":
    case "LED":
      return BOX[endpoint].y;
    default:
      return BOX[endpoint].y + BOX[endpoint].h;
  }
}
