// Formatação de valores para os painéis (sem React).

import { toSigned16 } from "@/core/alu";

/** Binário com zeros à esquerda, agrupado de 4 em 4: 0x00CA → "0000 0000 1100 1010". */
export function toBinary(value: number, bits = 16): string {
  return value
    .toString(2)
    .padStart(bits, "0")
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Decimal sem sinal e, quando o bit 15 está ligado, também com sinal: "65535 (−1)". */
export function toDecimal(value: number): string {
  if (value < 0x8000) {
    return String(value);
  }
  return `${value} (${String(toSigned16(value)).replace("-", "−")})`;
}

/**
 * Lê o valor digitado para o teclado: decimal (−32768 a 65535, negativos em
 * complemento de dois) ou hexadecimal com "0x". Retorna undefined se inválido.
 */
export function parseWordInput(text: string): number | undefined {
  const trimmed = text.trim();
  let value: number;
  if (/^0x[0-9a-f]{1,4}$/i.test(trimmed)) {
    value = parseInt(trimmed.slice(2), 16);
  } else if (/^[-−]?\d+$/.test(trimmed)) {
    value = Number(trimmed.replace("−", "-"));
  } else {
    return undefined;
  }
  if (value < -0x8000 || value > 0xffff) {
    return undefined;
  }
  return value & 0xffff;
}
