// Unidade de Controle (UC): gera a sequência de microetapas de cada instrução (§4.6).
//
// A UC funciona como um sequenciador. O par (phase, microIndex) do estado diz
// qual é a próxima microetapa. Cada fase tem um plano (uma lista de
// micro-operações) e, quando o plano termina, a UC passa para a fase seguinte:
//
//   BOOT → FETCH → DECODE → EXECUTE → FETCH → DECODE → EXECUTE → ...
//
// O plano de FETCH é o mesmo para toda instrução. O plano de EXECUTE depende da
// instrução no IR, do endereço acessado (RAM ou E/S) e, nos desvios, das flags.

import { aluExecute, toSigned16 } from "./alu";
import { deviceAt, readIo, writeIo } from "./io";
import { decode, formatInstruction, specForMnemonic, toHex } from "./isa";
import { createMemory, IO_REGION_START, isIoAddress, RAM_WAIT_CYCLES, readWord, writeWord } from "./memory";
import type { AluOp, ComponentId, Flags, Instruction, MachineState, MicroStep, Phase, RegisterIndex } from "./types";

/** Microetapa descrita pela UC. Ciclo e alterações são preenchidos pela máquina. */
export type MicroDraft = Omit<MicroStep, "cycle" | "phase" | "instruction" | "changes">;

type MicroOp = (state: MachineState) => { state: MachineState; micro: MicroDraft };

/** Executa a próxima microetapa e posiciona a UC na seguinte. */
export function executeMicroOp(state: MachineState): {
  state: MachineState;
  micro: MicroDraft & { phase: Phase; instruction?: string };
} {
  const plan = planFor(state);
  const { state: after, micro } = plan[state.microIndex](state);
  const instruction = state.phase === "DECODE" || state.phase === "EXECUTE" ? instructionText(state) : undefined;
  return {
    state: after.halted ? { ...after, phase: "HALT", microIndex: 0 } : advance(after, state, plan.length),
    micro: {
      ...micro,
      phase: state.phase,
      ...(instruction && { instruction }),
      activeComponents: [...new Set(micro.activeComponents)],
    },
  };
}

const NEXT_PHASE: Record<Phase, Phase> = {
  BOOT: "FETCH",
  FETCH: "DECODE",
  DECODE: "EXECUTE",
  EXECUTE: "FETCH",
  HALT: "HALT",
};

function advance(after: MachineState, before: MachineState, planLength: number): MachineState {
  const nextIndex = before.microIndex + 1;
  return nextIndex < planLength
    ? { ...after, phase: before.phase, microIndex: nextIndex }
    : { ...after, phase: NEXT_PHASE[before.phase], microIndex: 0 };
}

function planFor(state: MachineState): MicroOp[] {
  switch (state.phase) {
    case "BOOT":
      return [boot];
    case "FETCH":
      return isIoAddress(state.pc) ? [fetchOutsideProgram] : FETCH_PLAN;
    case "DECODE":
      return [decodeInstruction];
    case "EXECUTE":
      return executePlan(state);
    case "HALT":
      return [stopped];
  }
}

// ---------------------------------------------------------------------------
// BOOT e parada

const boot: MicroOp = (state) => ({
  state: { ...state, memory: createMemory(state.disk) },
  micro: {
    title: "Loader: disco → RAM",
    explanation:
      `O loader copia o programa (${state.disk.length} palavras) do disco para a RAM, a partir do endereço 0x00. ` +
      `Em seguida, a CPU começa a buscar a primeira instrução no endereço indicado pelo PC (${toHex(state.pc, 2)}).`,
    activeComponents: ["DISK", "RAM"],
    buses: { control: ["RESET"] },
  },
});

const stopped: MicroOp = (state) => ({
  state,
  micro: {
    title: "Máquina parada",
    explanation: state.error
      ? `A execução foi interrompida: ${state.error} Use Reset para recomeçar.`
      : "O programa terminou com HLT. Use Reset para executar novamente.",
    activeComponents: [],
    buses: { control: [] },
  },
});

/** Interrompe a execução com uma exceção didática (não é um crash do simulador). */
function exception(state: MachineState, error: string, title: string, components: ComponentId[]) {
  return {
    state: { ...state, halted: true, error },
    micro: {
      title,
      explanation: `${error} A UC interrompe a execução (exceção didática).`,
      activeComponents: ["CONTROL_UNIT", ...components],
      buses: { control: ["CLOCK", "HALT"] },
    } satisfies MicroDraft,
  };
}

// ---------------------------------------------------------------------------
// BUSCA (fetch) — idêntica para toda instrução

const marFromPc: MicroOp = (state) => ({
  state: { ...state, mar: state.pc },
  micro: {
    title: "MAR ← PC",
    explanation: `A UC copia o PC (${toHex(state.pc, 2)}) para o MAR, que coloca o endereço da próxima instrução no barramento de endereços.`,
    activeComponents: ["CONTROL_UNIT", "PC", "MAR"],
    buses: { address: state.pc, control: ["CLOCK"] },
  },
});

const memoryReadRequest: MicroOp = (state) => ({
  state,
  micro: {
    title: "MEM_READ: leitura da RAM",
    explanation:
      `A UC ativa MEM_READ e a RAM localiza o endereço ${toHex(state.mar, 2)}. ` +
      `Como a RAM é mais lenta que a CPU, a CPU aguarda ${RAM_WAIT_CYCLES} ciclos de espera (wait states).`,
    activeComponents: ["CONTROL_UNIT", "MAR", "RAM"],
    buses: { address: state.mar, control: ["CLOCK", "MEM_READ"] },
    waitCycles: RAM_WAIT_CYCLES,
  },
});

const mdrFromMemory: MicroOp = (state) => {
  const word = readWord(state.memory, state.mar);
  return {
    state: { ...state, mdr: word },
    micro: {
      title: "MDR ← M[MAR]",
      explanation: `A RAM coloca a palavra ${toHex(word, 4)} no barramento de dados e o MDR a armazena.`,
      activeComponents: ["RAM", "MDR"],
      buses: { address: state.mar, data: word, control: ["CLOCK", "MEM_READ"] },
    },
  };
};

const irFromMdr: MicroOp = (state) => {
  const nextPc = (state.pc + 1) & 0xff;
  return {
    state: { ...state, ir: state.mdr, pc: nextPc },
    micro: {
      title: "IR ← MDR; PC ← PC + 1",
      explanation: `A instrução vai do MDR para o IR (IR_LOAD) e o PC avança para ${toHex(nextPc, 2)} (PC_INC), já apontando para a próxima instrução.`,
      activeComponents: ["CONTROL_UNIT", "MDR", "IR", "PC"],
      buses: { control: ["CLOCK", "IR_LOAD", "PC_INC"] },
    },
  };
};

const FETCH_PLAN: MicroOp[] = [marFromPc, memoryReadRequest, mdrFromMemory, irFromMdr];

const fetchOutsideProgram: MicroOp = (state) =>
  exception(
    state,
    `O PC (${toHex(state.pc, 2)}) aponta para a região de E/S (${toHex(IO_REGION_START, 2)}–0xFF), onde não há instruções.`,
    "Exceção: busca fora da área de programa",
    ["PC"],
  );

// ---------------------------------------------------------------------------
// DECODIFICAÇÃO (decode)

const decodeInstruction: MicroOp = (state) => {
  const result = decode(state.ir);
  if (!result.valid) {
    return exception(state, result.error, "Exceção: instrução inválida", ["IR"]);
  }
  const instruction = result.instruction;
  const spec = specForMnemonic(instruction.mnemonic);
  return {
    state,
    micro: {
      title: `Decodifica IR: ${formatInstruction(instruction)}`,
      explanation:
        `A UC separa os campos do IR (${toHex(state.ir, 4)}): ${describeFields(instruction, result.fields.opcode)}. ` +
        `Operação: ${spec?.operation}.`,
      activeComponents: ["CONTROL_UNIT", "IR"],
      buses: { control: ["CLOCK"] },
    },
  };
};

function describeFields(instruction: Instruction, opcodeValue: number): string {
  const { mnemonic, rd, rs, operand } = instruction;
  const opcode = `opcode ${toHex(opcodeValue, 1)} = ${mnemonic}`;
  switch (specForMnemonic(mnemonic)?.format) {
    case "RD":
      return `${opcode}, rd = R${rd}`;
    case "RD_RS":
      return `${opcode}, rd = R${rd}, rs = R${rs}`;
    case "RD_IMM":
      return `${opcode}, rd = R${rd}, imm = ${operand}`;
    case "RD_ADDR":
      return `${opcode}, rd = R${rd}, addr = ${toHex(operand, 2)}`;
    case "ADDR":
      return `${opcode}, addr = ${toHex(operand, 2)}`;
    default:
      return opcode;
  }
}

// ---------------------------------------------------------------------------
// EXECUÇÃO (execute)

function executePlan(state: MachineState): MicroOp[] {
  const instruction = instructionInIr(state);
  switch (instruction.mnemonic) {
    case "NOP":
      return [nop];
    case "LOAD":
      return isIoAddress(instruction.operand)
        ? [marFromIr, ioReadRequest, ioReadResponse, mdrFromIo, registerFromMdr]
        : [marFromIr, memoryReadRequest, mdrFromMemory, registerFromMdr];
    case "STORE":
      return isIoAddress(instruction.operand)
        ? [prepareStore, ioWriteRequest, ioWriteResponse]
        : [prepareStore, memoryWrite];
    case "LDI":
      return [loadImmediate];
    case "MOV":
      return [move];
    case "ADD":
    case "SUB":
    case "AND":
    case "OR":
    case "NOT":
      return [aluInputs, aluCompute, aluWriteBack];
    case "JMP":
      return [jump];
    case "JZ":
    case "JN":
      return branchTaken(instruction, state.flags) ? [testFlag, jump] : [testFlag];
    case "HLT":
      return [halt];
  }
}

/** Instrução no IR. Só é usada depois da decodificação, que já validou o opcode. */
function instructionInIr(state: MachineState): Instruction {
  const result = decode(state.ir);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.instruction;
}

function instructionText(state: MachineState): string | undefined {
  const result = decode(state.ir);
  return result.valid ? formatInstruction(result.instruction) : undefined;
}

const REGISTER: Record<RegisterIndex, ComponentId> = { 0: "R0", 1: "R1", 2: "R2", 3: "R3" };

function withRegister(state: MachineState, index: RegisterIndex, value: number): MachineState {
  const registers = [...state.registers] as [number, number, number, number];
  registers[index] = value;
  return { ...state, registers };
}

const nop: MicroOp = (state) => ({
  state,
  micro: {
    title: "NOP: nenhuma operação",
    explanation: "NOP não altera registradores nem memória: a UC apenas consome um ciclo e segue para a próxima busca.",
    activeComponents: ["CONTROL_UNIT"],
    buses: { control: ["CLOCK"] },
  },
});

// --- LOAD / STORE ----------------------------------------------------------

const marFromIr: MicroOp = (state) => {
  const address = instructionInIr(state).operand;
  return {
    state: { ...state, mar: address },
    micro: {
      title: "MAR ← addr",
      explanation: `A UC copia o endereço ${toHex(address, 2)} do campo addr do IR para o MAR, que o coloca no barramento de endereços.`,
      activeComponents: ["CONTROL_UNIT", "IR", "MAR"],
      buses: { address, control: ["CLOCK"] },
    },
  };
};

const registerFromMdr: MicroOp = (state) => {
  const { rd } = instructionInIr(state);
  return {
    state: withRegister(state, rd, state.mdr),
    micro: {
      title: `R${rd} ← MDR`,
      explanation: `O valor ${state.mdr} do MDR é gravado em R${rd} (REG_WRITE).`,
      activeComponents: ["CONTROL_UNIT", "MDR", REGISTER[rd]],
      buses: { control: ["CLOCK", "REG_WRITE"] },
    },
  };
};

const prepareStore: MicroOp = (state) => {
  const { rd, operand: address } = instructionInIr(state);
  const value = state.registers[rd];
  return {
    state: { ...state, mar: address, mdr: value },
    micro: {
      title: `MAR ← addr; MDR ← R${rd}`,
      explanation: `A UC coloca o endereço ${toHex(address, 2)} no MAR e copia R${rd} (${value}) para o MDR, preparando a escrita.`,
      activeComponents: ["CONTROL_UNIT", "IR", "MAR", REGISTER[rd], "MDR"],
      buses: { address, control: ["CLOCK"] },
    },
  };
};

const memoryWrite: MicroOp = (state) => ({
  state: { ...state, memory: writeWord(state.memory, state.mar, state.mdr) },
  micro: {
    title: "MEM_WRITE: M[MAR] ← MDR",
    explanation:
      `A UC ativa MEM_WRITE: o MDR coloca ${state.mdr} no barramento de dados e a RAM grava o valor em ${toHex(state.mar, 2)}. ` +
      `A escrita na RAM também custa ${RAM_WAIT_CYCLES} ciclos de espera.`,
    activeComponents: ["CONTROL_UNIT", "MAR", "MDR", "RAM"],
    buses: { address: state.mar, data: state.mdr, control: ["CLOCK", "MEM_WRITE"] },
    waitCycles: RAM_WAIT_CYCLES,
  },
});

// --- E/S mapeada em memória: microetapa extra com o dispositivo respondendo --

function deviceComponents(state: MachineState): ComponentId[] {
  const device = deviceAt(state.mar);
  return device ? [device.component] : [];
}

/** Para onde vai um acesso à região de E/S, ex.: "o pedido vai para o teclado". */
function ioDestination(state: MachineState): string {
  const device = deviceAt(state.mar);
  return device ? `o pedido vai para o ${device.name}` : "não há dispositivo ligado a esse endereço";
}

const ioReadRequest: MicroOp = (state) => ({
  state,
  micro: {
    title: "MEM_READ: endereço de E/S",
    explanation:
      `A UC ativa MEM_READ. O endereço ${toHex(state.mar, 2)} pertence à região de E/S: ` +
      `a RAM não responde e ${ioDestination(state)}.`,
    activeComponents: ["CONTROL_UNIT", "MAR", ...deviceComponents(state)],
    buses: { address: state.mar, control: ["CLOCK", "MEM_READ"] },
  },
});

const ioReadResponse: MicroOp = (state) => {
  const device = deviceAt(state.mar);
  const value = readIo(state.io, state.mar);
  let explanation = `Nenhum dispositivo está ligado a ${toHex(state.mar, 2)}: o barramento de dados fica em 0.`;
  if (device?.direction === "input") {
    explanation = `O ${device.name} coloca o valor digitado (${value}) no barramento de dados.`;
  } else if (device) {
    explanation = `O ${device.name} devolve o valor que está exibindo (${value}) no barramento de dados.`;
  }
  return {
    state,
    micro: {
      title: device ? `${capitalize(device.name)} responde` : "Sem resposta de E/S",
      explanation,
      activeComponents: deviceComponents(state),
      buses: { address: state.mar, data: value, control: ["CLOCK", "MEM_READ"] },
    },
  };
};

const mdrFromIo: MicroOp = (state) => {
  const value = readIo(state.io, state.mar);
  return {
    state: { ...state, mdr: value },
    micro: {
      title: "MDR ← E/S[MAR]",
      explanation: `O MDR armazena o valor ${value} recebido pelo barramento de dados.`,
      activeComponents: [...deviceComponents(state), "MDR"],
      buses: { address: state.mar, data: value, control: ["CLOCK", "MEM_READ"] },
    },
  };
};

const ioWriteRequest: MicroOp = (state) => ({
  state,
  micro: {
    title: "MEM_WRITE: endereço de E/S",
    explanation:
      `A UC ativa MEM_WRITE e o MDR coloca ${state.mdr} no barramento de dados. ` +
      `O endereço ${toHex(state.mar, 2)} é de E/S: a RAM ignora a escrita e ${ioDestination(state)}.`,
    activeComponents: ["CONTROL_UNIT", "MAR", "MDR", ...deviceComponents(state)],
    buses: { address: state.mar, data: state.mdr, control: ["CLOCK", "MEM_WRITE"] },
  },
});

const ioWriteResponse: MicroOp = (state) => {
  const device = deviceAt(state.mar);
  let explanation = `Nenhum dispositivo está ligado a ${toHex(state.mar, 2)}: a escrita é ignorada.`;
  if (device?.direction === "input") {
    explanation = `O ${device.name} é um dispositivo apenas de entrada: a escrita é ignorada.`;
  } else if (device?.component === "DISPLAY") {
    explanation = `O display captura o valor do barramento de dados e passa a mostrar ${state.mdr}.`;
  } else if (device) {
    explanation = `O LED/status recebe ${toHex(state.mdr, 4)} e acende conforme os bits do valor.`;
  }
  return {
    state: { ...state, io: writeIo(state.io, state.mar, state.mdr) },
    micro: {
      title: device ? `${capitalize(device.name)} responde` : "Sem resposta de E/S",
      explanation,
      activeComponents: deviceComponents(state),
      buses: { address: state.mar, data: state.mdr, control: ["CLOCK", "MEM_WRITE"] },
    },
  };
};

// --- Transferências entre registradores -----------------------------------

const loadImmediate: MicroOp = (state) => {
  const { rd, operand } = instructionInIr(state);
  return {
    state: withRegister(state, rd, operand),
    micro: {
      title: `R${rd} ← ${operand}`,
      explanation: `O valor imediato ${operand} vem do próprio IR (campo imm) e é gravado em R${rd} (REG_WRITE), com os 8 bits altos zerados.`,
      activeComponents: ["CONTROL_UNIT", "IR", REGISTER[rd]],
      buses: { control: ["CLOCK", "REG_WRITE"] },
    },
  };
};

const move: MicroOp = (state) => {
  const { rd, rs } = instructionInIr(state);
  const value = state.registers[rs];
  return {
    state: withRegister(state, rd, value),
    micro: {
      title: `R${rd} ← R${rs}`,
      explanation: `O valor de R${rs} (${value}) é copiado para R${rd} (REG_WRITE). MOV não passa pela ULA e não altera as flags.`,
      activeComponents: ["CONTROL_UNIT", REGISTER[rs], REGISTER[rd]],
      buses: { control: ["CLOCK", "REG_WRITE"] },
    },
  };
};

// --- ULA -------------------------------------------------------------------

const OPERATOR: Record<AluOp, string> = { ADD: "+", SUB: "−", AND: "AND", OR: "OR", NOT: "NOT" };

const aluInputs: MicroOp = (state) => {
  const { mnemonic, rd, rs } = instructionInIr(state);
  const [a, b] = [state.registers[rd], state.registers[rs]];
  const unary = mnemonic === "NOT";
  return {
    state,
    micro: {
      title: unary ? `ULA ← R${rd}` : `ULA ← R${rd}, R${rs}`,
      explanation: unary
        ? `A UC envia R${rd} (${a}) para a entrada da ULA e seleciona a operação (ALU_OP = NOT).`
        : `A UC envia R${rd} (${a}) e R${rs} (${b}) para as entradas da ULA e seleciona a operação (ALU_OP = ${mnemonic}).`,
      activeComponents: unary
        ? ["CONTROL_UNIT", REGISTER[rd], "ALU"]
        : ["CONTROL_UNIT", REGISTER[rd], REGISTER[rs], "ALU"],
      buses: { control: ["CLOCK", "ALU_OP"] },
    },
  };
};

const aluCompute: MicroOp = (state) => {
  const { mnemonic, rd, rs } = instructionInIr(state);
  const op = mnemonic as AluOp;
  const [a, b] = [state.registers[rd], state.registers[rs]];
  const { result, flags } = aluExecute(op, a, b, state.flags);
  return {
    state: { ...state, aluOutput: result, flags },
    micro: {
      title: "ULA calcula resultado e flags",
      explanation: describeAluResult(op, a, b, result, flags),
      activeComponents: ["ALU", "FLAGS"],
      buses: { control: ["CLOCK", "ALU_OP"] },
    },
  };
};

function describeAluResult(op: AluOp, a: number, b: number, result: number, flags: Flags): string {
  const bit = (value: boolean) => (value ? 1 : 0);
  if (op === "ADD" || op === "SUB") {
    const overflow = flags.V ? " V=1 indica overflow: o resultado não cabe em 16 bits com sinal." : "";
    return (
      `A ULA calcula ${toSigned16(a)} ${OPERATOR[op]} ${toSigned16(b)} = ${toSigned16(result)} ` +
      `e atualiza as flags Z=${bit(flags.Z)}, N=${bit(flags.N)}, C=${bit(flags.C)}, V=${bit(flags.V)}.${overflow}`
    );
  }
  const expression = op === "NOT" ? `NOT ${toHex(a, 4)}` : `${toHex(a, 4)} ${OPERATOR[op]} ${toHex(b, 4)}`;
  return `A ULA calcula ${expression} = ${toHex(result, 4)} e atualiza as flags Z=${bit(flags.Z)}, N=${bit(flags.N)}; C e V não mudam.`;
}

const aluWriteBack: MicroOp = (state) => {
  const { rd } = instructionInIr(state);
  return {
    state: withRegister(state, rd, state.aluOutput),
    micro: {
      title: `R${rd} ← resultado`,
      explanation: `O resultado (${state.aluOutput}) sai da ULA e é gravado em R${rd} (REG_WRITE).`,
      activeComponents: ["ALU", REGISTER[rd]],
      buses: { control: ["CLOCK", "REG_WRITE"] },
    },
  };
};

// --- Desvios e parada ------------------------------------------------------

function branchTaken(instruction: Instruction, flags: Flags): boolean {
  return instruction.mnemonic === "JZ" ? flags.Z : flags.N;
}

const testFlag: MicroOp = (state) => {
  const instruction = instructionInIr(state);
  const flag = instruction.mnemonic === "JZ" ? "Z" : "N";
  const meaning = flag === "Z" ? "foi zero" : "foi negativo";
  const explanation = branchTaken(instruction, state.flags)
    ? `${flag} = 1 (o último resultado da ULA ${meaning}): o desvio será tomado.`
    : `${flag} = 0: o desvio não é tomado e o PC continua em ${toHex(state.pc, 2)}, a instrução seguinte.`;
  return {
    state,
    micro: {
      title: `UC testa a flag ${flag}`,
      explanation,
      activeComponents: ["CONTROL_UNIT", "FLAGS"],
      buses: { control: ["CLOCK"] },
    },
  };
};

const jump: MicroOp = (state) => {
  const address = instructionInIr(state).operand;
  return {
    state: { ...state, pc: address },
    micro: {
      title: `PC ← ${toHex(address, 2)}`,
      explanation: `A UC carrega o endereço ${toHex(address, 2)} do IR no PC (PC_LOAD). A próxima busca acontecerá nesse endereço.`,
      activeComponents: ["CONTROL_UNIT", "IR", "PC"],
      buses: { control: ["CLOCK", "PC_LOAD"] },
    },
  };
};

const halt: MicroOp = (state) => ({
  state: { ...state, halted: true },
  micro: {
    title: "HLT: fim da execução",
    explanation: "A UC ativa o sinal HALT e o clock para. O programa terminou; use Reset para executar de novo.",
    activeComponents: ["CONTROL_UNIT"],
    buses: { control: ["CLOCK", "HALT"] },
  },
});

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
