// Tipos do motor NeoCore-8 (CLAUDE.md §4 e §5.2).
// Apenas declarações: nenhuma lógica vive neste arquivo.

/** Palavra de 16 bits (0x0000–0xFFFF). */
export type Word = number;

/** Endereço de 8 bits (0x00–0xFF), endereçamento por palavra. */
export type Address = number;

/** Fase do ciclo de máquina exibida no indicador da UI. */
export type Phase = "BOOT" | "FETCH" | "DECODE" | "EXECUTE" | "HALT";

/** Sinais do barramento de controle (§4.2). */
export type ControlSignal =
  | "MEM_READ"
  | "MEM_WRITE"
  | "CLOCK"
  | "RESET"
  | "ALU_OP"
  | "REG_WRITE"
  | "PC_INC"
  | "PC_LOAD"
  | "IR_LOAD"
  | "HALT";

/** Componentes do diagrama que podem ser destacados em uma microetapa. */
export type ComponentId =
  // CPU
  | "CONTROL_UNIT"
  | "ALU"
  | "R0"
  | "R1"
  | "R2"
  | "R3"
  | "PC"
  | "IR"
  | "MAR"
  | "MDR"
  | "FLAGS"
  // Hierarquia de memória
  | "CACHE"
  | "RAM"
  | "DISK"
  // Dispositivos de E/S mapeados em memória
  | "KEYBOARD"
  | "DISPLAY"
  | "LED";

/** Registradores de uso geral R0–R3 (16 bits). */
export type RegisterIndex = 0 | 1 | 2 | 3;

/** Mnemônicos da ISA NeoCore-8 (§4.4). */
export type Mnemonic =
  | "NOP"
  | "LOAD"
  | "STORE"
  | "LDI"
  | "MOV"
  | "ADD"
  | "SUB"
  | "AND"
  | "OR"
  | "NOT"
  | "JMP"
  | "JZ"
  | "JN"
  | "HLT";

/** Operações executadas pela ULA (as instruções que atualizam flags). */
export type AluOp = "ADD" | "SUB" | "AND" | "OR" | "NOT";

/** Campos brutos de uma palavra de instrução (§4.3). */
export type InstructionFields = {
  readonly opcode: number; // bits 15–12
  readonly rd: RegisterIndex; // bits 11–10
  readonly rs: RegisterIndex; // bits 9–8
  readonly operand: number; // bits 7–0: imediato ou endereço
};

/**
 * Instrução decodificada. Todos os campos são mantidos, mesmo os que a
 * instrução não usa, para que encode(decode(w)) === w.
 */
export type Instruction = {
  readonly mnemonic: Mnemonic;
  readonly rd: RegisterIndex;
  readonly rs: RegisterIndex;
  readonly operand: number;
};

/** Flags de estado produzidas pela ULA. */
export type Flags = {
  readonly Z: boolean; // zero
  readonly N: boolean; // negativo
  readonly C: boolean; // carry (vai-um)
  readonly V: boolean; // overflow
};

/** Tipo de evento de cache registrado em uma microetapa. */
export type CacheEventType = "HIT" | "MISS" | "WRITE" | "BYPASS";

/** Linha da cache L1 de mapeamento direto (8 linhas, 1 palavra/linha). */
export type CacheLine = {
  readonly valid: boolean;
  readonly tag: number; // 5 bits
  readonly data: Word;
  readonly lastEvent?: CacheEventType;
};

/** Contrato de uma microetapa (§5.2). A UI renderiza exatamente o que vem aqui. */
export type MicroStep = {
  cycle: number; // ciclo de clock acumulado
  phase: Phase;
  instruction?: string; // ex.: "ADD R1, R2"
  title: string; // ex.: "IR ← MDR"
  explanation: string; // texto didático pt-BR, 1–3 frases
  activeComponents: ComponentId[]; // o que acender no diagrama
  buses: {
    address?: number;
    data?: number;
    control: ControlSignal[];
  };
  changes: { target: string; from: number; to: number }[]; // registradores/memória alterados
  cache?: { type: CacheEventType; index: number; tag: number };
  waitCycles?: number;
};

/** Estado completo e imutável da máquina simulada. */
export type MachineState = {
  readonly registers: readonly [Word, Word, Word, Word]; // R0–R3
  readonly pc: Address; // 8 bits
  readonly ir: Word; // 16 bits
  readonly mar: Address; // 8 bits
  readonly mdr: Word; // 16 bits
  readonly flags: Flags;
  readonly memory: readonly Word[]; // 256 palavras (RAM + região de E/S 0xF0–0xFF)
  readonly cache: {
    readonly lines: readonly CacheLine[]; // 8 linhas
    readonly hits: number;
    readonly misses: number;
  };
  readonly io: {
    readonly keyboard: Word; // 0xF0 — entrada
    readonly display: Word; // 0xF1 — saída
    readonly led: Word; // 0xF2 — LED/status
  };
  readonly disk: readonly Word[]; // programa salvo, copiado para a RAM no boot/reset
  readonly cycle: number; // ciclos de clock acumulados
  readonly phase: Phase;
  readonly halted: boolean;
  readonly error?: string; // ex.: "instrução inválida" (exceção didática, não crash)
};
