// Programas de exemplo obrigatórios (§6.3), em assembly NeoCore-8.

import type { Word } from "./types";

export type ExampleProgram = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: string;
  readonly keyboard: Word; // entrada sugerida para o teclado (0xF0)
};

export const EXAMPLES: readonly ExampleProgram[] = [
  {
    id: "soma-simples",
    name: "Soma simples",
    description:
      "Lê um número do teclado, soma com uma constante da memória e mostra o resultado no display. " +
      "Percorre o ciclo completo com E/S, RAM e ULA.",
    keyboard: 5,
    source: `LOAD  R0, [0xF0]   ; lê número do teclado (E/S)
LOAD  R1, [0x20]   ; lê constante da memória
ADD   R0, R1       ; ULA soma
STORE R0, [0xF1]   ; mostra no display (E/S)
HLT
.org 0x20
.word 7
`,
  },
  {
    id: "contador-laco",
    name: "Contador com laço",
    description:
      "Conta de 5 até 0 mostrando cada valor no display e acende o LED ao terminar. " +
      "Mostra o desvio condicional JZ, a flag Z e, a partir da 2ª volta, o ganho da cache.",
    keyboard: 0,
    source: `; Contador regressivo: 5, 4, 3, 2, 1, 0
        LDI   R0, 5        ; R0 = contador
loop:   STORE R0, [0xF1]   ; mostra o contador no display
        LOAD  R1, [passo]  ; R1 = 1 (constante na memória)
        SUB   R0, R1       ; R0 = R0 - 1 (atualiza a flag Z)
        JZ    fim          ; chegou a zero? sai do laço
        JMP   loop         ; senão, repete
fim:    STORE R0, [0xF1]   ; mostra 0
        LDI   R2, 1
        STORE R2, [0xF2]   ; acende o LED: contagem terminada
        HLT
passo:  .word 1
`,
  },
  {
    id: "logica-bits",
    name: "Lógica bit a bit",
    description:
      "Usa uma máscara para isolar, ligar e apagar bits com AND, OR e NOT. " +
      "Observe os valores em binário nos registradores.",
    keyboard: 0,
    source: `; Máscara 0x0F aplicada ao valor 0xCA (1100 1010)
LDI   R0, 0xCA     ; R0 = 0000 0000 1100 1010
LDI   R1, 0x0F     ; R1 = 0000 0000 0000 1111 (máscara)
MOV   R2, R0
AND   R2, R1       ; R2 = 0000 0000 0000 1010: isola os 4 bits baixos
MOV   R3, R0
OR    R3, R1       ; R3 = 0000 0000 1100 1111: liga os 4 bits baixos
NOT   R1           ; R1 = 1111 1111 1111 0000: inverte a máscara (N = 1)
AND   R0, R1       ; R0 = 0000 0000 1100 0000: apaga os 4 bits baixos
STORE R2, [0xF1]   ; display mostra 10 (0x0A)
STORE R3, [0xF2]   ; LED/status recebe 0x00CF
HLT
`,
  },
];
