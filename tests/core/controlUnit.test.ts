import { describe, expect, it } from "vitest";
import { createMachine, step } from "@/core/machine";
import { executeMicros, runSource, shape, splitByInstruction } from "./helpers";

// Prepara R1 = 5 e R2 = 3 antes da instrução testada (que é sempre a 3ª executada).
const SETUP = "LDI R1, 5\nLDI R2, 3\n";

describe("BUSCA (fetch)", () => {
  // Programa que executa as 14 instruções da ISA.
  const ALL_INSTRUCTIONS = `
        NOP
        LDI   R1, 5
        LDI   R2, 3
        MOV   R3, R1
        ADD   R3, R2
        SUB   R3, R2
        AND   R3, R2
        OR    R3, R2
        NOT   R3          ; R3 negativo: Z = 0, N = 1
        LOAD  R0, [dado]
        LOAD  R0, [0xF0]
        STORE R0, [0x40]
        STORE R0, [0xF1]
        JZ    fim         ; não desvia (Z = 0)
        JN    proximo     ; desvia (N = 1)
proximo: JMP  fim
fim:    HLT
dado:   .word 42
`;

  it("tem as mesmas 4 microetapas para toda instrução", () => {
    const { state, micros } = runSource(ALL_INSTRUCTIONS, 9);
    expect(state.halted).toBe(true);
    const groups = splitByInstruction(micros);
    const executed = new Set(groups.map((group) => group.find((micro) => micro.instruction)?.instruction?.split(" ")[0]));
    expect(executed.size).toBe(14);

    const fetches = groups.map((group) => group.filter((micro) => micro.phase === "FETCH").map(shape));
    expect(fetches[0]).toEqual([
      { phase: "FETCH", title: "MAR ← PC", activeComponents: ["CONTROL_UNIT", "PC", "MAR"], control: ["CLOCK"], waitCycles: undefined },
      {
        phase: "FETCH",
        title: "MEM_READ: leitura da RAM",
        activeComponents: ["CONTROL_UNIT", "MAR", "RAM"],
        control: ["CLOCK", "MEM_READ"],
        waitCycles: 4,
      },
      { phase: "FETCH", title: "MDR ← M[MAR]", activeComponents: ["RAM", "MDR"], control: ["CLOCK", "MEM_READ"], waitCycles: undefined },
      {
        phase: "FETCH",
        title: "IR ← MDR; PC ← PC + 1",
        activeComponents: ["CONTROL_UNIT", "MDR", "IR", "PC"],
        control: ["CLOCK", "IR_LOAD", "PC_INC"],
        waitCycles: undefined,
      },
    ]);
    for (const fetch of fetches) {
      expect(fetch).toEqual(fetches[0]);
    }
  });

  it("transporta o PC no barramento de endereços e a instrução no de dados", () => {
    const { micros } = runSource("NOP\nHLT");
    const [, second] = splitByInstruction(micros);
    expect(second[0].buses.address).toBe(0x01);
    expect(second[2].buses.data).toBe(0xf000);
    expect(second[3].changes).toEqual([
      { target: "PC", from: 1, to: 2 },
      { target: "IR", from: 0x0000, to: 0xf000 },
    ]);
  });

  it("ainda não conhece a instrução; a decodificação a identifica", () => {
    const { micros } = runSource("LDI R1, 5\nHLT");
    const [first] = splitByInstruction(micros);
    expect(first.filter((micro) => micro.phase === "FETCH").every((micro) => micro.instruction === undefined)).toBe(true);
    const decodeStep = first.find((micro) => micro.phase === "DECODE");
    expect(decodeStep).toMatchObject({
      instruction: "LDI R1, 5",
      title: "Decodifica IR: LDI R1, 5",
      activeComponents: ["CONTROL_UNIT", "IR"],
      buses: { control: ["CLOCK"] },
      changes: [],
    });
    expect(decodeStep?.explanation).toContain("opcode 0x3 = LDI, rd = R1, imm = 5");
  });

  it("descreve na decodificação apenas os campos usados por cada formato", () => {
    const { micros } = runSource("NOT R1\nMOV R2, R1\nLOAD R0, [0x10]\nJMP fim\nfim: HLT");
    const decodes = micros.filter((micro) => micro.phase === "DECODE").map((micro) => micro.explanation);
    expect(decodes[0]).toContain("opcode 0x9 = NOT, rd = R1.");
    expect(decodes[1]).toContain("opcode 0x4 = MOV, rd = R2, rs = R1.");
    expect(decodes[2]).toContain("opcode 0x1 = LOAD, rd = R0, addr = 0x10.");
    expect(decodes[3]).toContain("opcode 0xA = JMP, addr = 0x04.");
    expect(decodes[4]).toContain("opcode 0xF = HLT.");
  });
});

describe("EXECUÇÃO — microetapas e estado final por instrução", () => {
  it("NOP", () => {
    const { state, micros } = runSource("NOP\nHLT");
    expect(executeMicros(micros, 0).map(shape)).toEqual([
      { phase: "EXECUTE", title: "NOP: nenhuma operação", activeComponents: ["CONTROL_UNIT"], control: ["CLOCK"], waitCycles: undefined },
    ]);
    expect(state.registers).toEqual([0, 0, 0, 0]);
  });

  it("LOAD da RAM", () => {
    const { state, micros } = runSource("LOAD R3, [dado]\nHLT\ndado: .word 0x1234");
    const steps = executeMicros(micros, 0);
    expect(steps.map(shape)).toEqual([
      { phase: "EXECUTE", title: "MAR ← addr", activeComponents: ["CONTROL_UNIT", "IR", "MAR"], control: ["CLOCK"], waitCycles: undefined },
      {
        phase: "EXECUTE",
        title: "MEM_READ: leitura da RAM",
        activeComponents: ["CONTROL_UNIT", "MAR", "RAM"],
        control: ["CLOCK", "MEM_READ"],
        waitCycles: 4,
      },
      { phase: "EXECUTE", title: "MDR ← M[MAR]", activeComponents: ["RAM", "MDR"], control: ["CLOCK", "MEM_READ"], waitCycles: undefined },
      {
        phase: "EXECUTE",
        title: "R3 ← MDR",
        activeComponents: ["CONTROL_UNIT", "MDR", "R3"],
        control: ["CLOCK", "REG_WRITE"],
        waitCycles: undefined,
      },
    ]);
    expect(steps[0].buses.address).toBe(0x02);
    expect(steps[2].buses.data).toBe(0x1234);
    expect(state.registers[3]).toBe(0x1234);
  });

  it("LOAD do teclado (E/S): microetapa extra com o dispositivo respondendo", () => {
    const { state, micros } = runSource("LOAD R3, [0xF0]\nHLT", 42);
    const steps = executeMicros(micros, 0);
    expect(steps.map(shape)).toEqual([
      { phase: "EXECUTE", title: "MAR ← addr", activeComponents: ["CONTROL_UNIT", "IR", "MAR"], control: ["CLOCK"], waitCycles: undefined },
      {
        phase: "EXECUTE",
        title: "MEM_READ: endereço de E/S",
        activeComponents: ["CONTROL_UNIT", "MAR", "KEYBOARD"],
        control: ["CLOCK", "MEM_READ"],
        waitCycles: undefined,
      },
      { phase: "EXECUTE", title: "Teclado responde", activeComponents: ["KEYBOARD"], control: ["CLOCK", "MEM_READ"], waitCycles: undefined },
      { phase: "EXECUTE", title: "MDR ← E/S[MAR]", activeComponents: ["KEYBOARD", "MDR"], control: ["CLOCK", "MEM_READ"], waitCycles: undefined },
      {
        phase: "EXECUTE",
        title: "R3 ← MDR",
        activeComponents: ["CONTROL_UNIT", "MDR", "R3"],
        control: ["CLOCK", "REG_WRITE"],
        waitCycles: undefined,
      },
    ]);
    expect(steps[2].explanation).toBe("O teclado coloca o valor digitado (42) no barramento de dados.");
    expect(steps[2].buses.data).toBe(42);
    expect(state.registers[3]).toBe(42);
  });

  it("LOAD de um dispositivo de saída devolve o valor exibido", () => {
    const { state, micros } = runSource(`${SETUP}STORE R1, [0xF1]\nLOAD R0, [0xF1]\nHLT`);
    expect(executeMicros(micros, 3)[2].explanation).toBe(
      "O display devolve o valor que está exibindo (5) no barramento de dados.",
    );
    expect(state.registers[0]).toBe(5);
  });

  it("LOAD de endereço de E/S sem dispositivo lê 0", () => {
    const { state, micros } = runSource(`${SETUP}LOAD R1, [0xF5]\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps[1].activeComponents).toEqual(["CONTROL_UNIT", "MAR"]);
    expect(steps[1].explanation).toContain("não há dispositivo ligado a esse endereço");
    expect(steps[2]).toMatchObject({ title: "Sem resposta de E/S", activeComponents: [] });
    expect(steps[2].explanation).toBe("Nenhum dispositivo está ligado a 0xF5: o barramento de dados fica em 0.");
    expect(state.registers[1]).toBe(0);
  });

  it("STORE na RAM", () => {
    const { state, micros } = runSource(`${SETUP}STORE R1, [0x30]\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps.map(shape)).toEqual([
      {
        phase: "EXECUTE",
        title: "MAR ← addr; MDR ← R1",
        activeComponents: ["CONTROL_UNIT", "IR", "MAR", "R1", "MDR"],
        control: ["CLOCK"],
        waitCycles: undefined,
      },
      {
        phase: "EXECUTE",
        title: "MEM_WRITE: M[MAR] ← MDR",
        activeComponents: ["CONTROL_UNIT", "MAR", "MDR", "RAM"],
        control: ["CLOCK", "MEM_WRITE"],
        waitCycles: 4,
      },
    ]);
    expect(steps[1].buses).toEqual({ address: 0x30, data: 5, control: ["CLOCK", "MEM_WRITE"] });
    expect(steps[1].changes).toEqual([{ target: "M[0x30]", from: 0, to: 5 }]);
    expect(state.memory[0x30]).toBe(5);
  });

  it("STORE no display (E/S): microetapa extra com o dispositivo respondendo", () => {
    const { state, micros } = runSource(`${SETUP}STORE R1, [0xF1]\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps.map(shape).slice(1)).toEqual([
      {
        phase: "EXECUTE",
        title: "MEM_WRITE: endereço de E/S",
        activeComponents: ["CONTROL_UNIT", "MAR", "MDR", "DISPLAY"],
        control: ["CLOCK", "MEM_WRITE"],
        waitCycles: undefined,
      },
      { phase: "EXECUTE", title: "Display responde", activeComponents: ["DISPLAY"], control: ["CLOCK", "MEM_WRITE"], waitCycles: undefined },
    ]);
    expect(steps[2].changes).toEqual([{ target: "DISPLAY", from: 0, to: 5 }]);
    expect(state.io.display).toBe(5);
    expect(state.memory[0xf1]).toBe(0); // a RAM não é escrita
  });

  it("STORE no LED", () => {
    const { state, micros } = runSource(`${SETUP}STORE R2, [0xF2]\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps[2]).toMatchObject({ title: "LED responde", activeComponents: ["LED"] });
    expect(steps[2].explanation).toBe("O LED/status recebe 0x0003 e acende conforme os bits do valor.");
    expect(state.io.led).toBe(3);
  });

  it("STORE no teclado é ignorado (dispositivo só de entrada)", () => {
    const { state, micros } = runSource(`${SETUP}STORE R1, [0xF0]\nHLT`, 9);
    const steps = executeMicros(micros, 2);
    expect(steps[2].explanation).toBe("O teclado é um dispositivo apenas de entrada: a escrita é ignorada.");
    expect(steps[2].changes).toEqual([]);
    expect(state.io).toEqual({ keyboard: 9, display: 0, led: 0 });
  });

  it("STORE em endereço de E/S sem dispositivo é ignorado", () => {
    const { state, micros } = runSource(`${SETUP}STORE R1, [0xF9]\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps[1].explanation).toContain("não há dispositivo ligado a esse endereço");
    expect(steps[2]).toMatchObject({ title: "Sem resposta de E/S", activeComponents: [] });
    expect(steps[2].explanation).toBe("Nenhum dispositivo está ligado a 0xF9: a escrita é ignorada.");
    expect(state.memory[0xf9]).toBe(0);
  });

  it("LDI", () => {
    const { state, micros } = runSource("LDI R3, 200\nHLT");
    expect(executeMicros(micros, 0).map(shape)).toEqual([
      {
        phase: "EXECUTE",
        title: "R3 ← 200",
        activeComponents: ["CONTROL_UNIT", "IR", "R3"],
        control: ["CLOCK", "REG_WRITE"],
        waitCycles: undefined,
      },
    ]);
    expect(state.registers[3]).toBe(200);
  });

  it("MOV não passa pela ULA nem altera flags", () => {
    const { state, micros } = runSource(`${SETUP}MOV R3, R1\nHLT`);
    expect(executeMicros(micros, 2).map(shape)).toEqual([
      {
        phase: "EXECUTE",
        title: "R3 ← R1",
        activeComponents: ["CONTROL_UNIT", "R1", "R3"],
        control: ["CLOCK", "REG_WRITE"],
        waitCycles: undefined,
      },
    ]);
    expect(state.registers).toEqual([0, 5, 3, 5]);
    expect(state.flags).toEqual({ Z: false, N: false, C: false, V: false });
  });

  const ALU_CASES = [
    { instruction: "ADD R1, R2", r1: 8, flags: { Z: false, N: false, C: false, V: false }, text: "5 + 3 = 8" },
    { instruction: "SUB R1, R2", r1: 2, flags: { Z: false, N: false, C: false, V: false }, text: "5 − 3 = 2" },
    { instruction: "AND R1, R2", r1: 1, flags: { Z: false, N: false, C: false, V: false }, text: "0x0005 AND 0x0003 = 0x0001" },
    { instruction: "OR R1, R2", r1: 7, flags: { Z: false, N: false, C: false, V: false }, text: "0x0005 OR 0x0003 = 0x0007" },
  ];

  it.each(ALU_CASES)("$instruction passa pela ULA em 3 microetapas", ({ instruction, r1, flags, text }) => {
    const { state, micros } = runSource(`${SETUP}${instruction}\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps.map(shape)).toEqual([
      {
        phase: "EXECUTE",
        title: "ULA ← R1, R2",
        activeComponents: ["CONTROL_UNIT", "R1", "R2", "ALU"],
        control: ["CLOCK", "ALU_OP"],
        waitCycles: undefined,
      },
      {
        phase: "EXECUTE",
        title: "ULA calcula resultado e flags",
        activeComponents: ["ALU", "FLAGS"],
        control: ["CLOCK", "ALU_OP"],
        waitCycles: undefined,
      },
      { phase: "EXECUTE", title: "R1 ← resultado", activeComponents: ["ALU", "R1"], control: ["CLOCK", "REG_WRITE"], waitCycles: undefined },
    ]);
    expect(steps[0].explanation).toContain(`ALU_OP = ${instruction.split(" ")[0]}`);
    expect(steps[1].explanation).toContain(text);
    expect(state.registers[1]).toBe(r1);
    expect(state.flags).toEqual(flags);
  });

  it("NOT usa uma única entrada da ULA", () => {
    const { state, micros } = runSource(`${SETUP}NOT R1\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps.map((micro) => [micro.title, micro.activeComponents])).toEqual([
      ["ULA ← R1", ["CONTROL_UNIT", "R1", "ALU"]],
      ["ULA calcula resultado e flags", ["ALU", "FLAGS"]],
      ["R1 ← resultado", ["ALU", "R1"]],
    ]);
    expect(steps[0].explanation).toContain("ALU_OP = NOT");
    expect(steps[1].explanation).toBe("A ULA calcula NOT 0x0005 = 0xFFFA e atualiza as flags Z=0, N=1; C e V não mudam.");
    expect(state.registers[1]).toBe(0xfffa);
    expect(state.flags.N).toBe(true);
  });

  it("ULA com o mesmo registrador nas duas entradas acende o componente uma vez", () => {
    const { state, micros } = runSource(`${SETUP}SUB R1, R1\nHLT`);
    const steps = executeMicros(micros, 2);
    expect(steps[0].activeComponents).toEqual(["CONTROL_UNIT", "R1", "ALU"]);
    expect(steps[1].changes).toEqual([{ target: "FLAGS.Z", from: 0, to: 1 }]);
    expect(state.flags.Z).toBe(true);
  });

  it("ULA explica o overflow", () => {
    const { state, micros } = runSource(`LOAD R1, [maximo]\nLDI R2, 1\nADD R1, R2\nHLT\nmaximo: .word 0x7FFF`);
    expect(executeMicros(micros, 2)[1].explanation).toBe(
      "A ULA calcula 32767 + 1 = -32768 e atualiza as flags Z=0, N=1, C=0, V=1. " +
        "V=1 indica overflow: o resultado não cabe em 16 bits com sinal.",
    );
    expect(state.flags.V).toBe(true);
  });

  it("JMP", () => {
    const { state, micros } = runSource("JMP pula\nLDI R3, 1\npula: HLT");
    expect(executeMicros(micros, 0).map(shape)).toEqual([
      { phase: "EXECUTE", title: "PC ← 0x02", activeComponents: ["CONTROL_UNIT", "IR", "PC"], control: ["CLOCK", "PC_LOAD"], waitCycles: undefined },
    ]);
    expect(state.registers[3]).toBe(0); // a instrução pulada não executou
  });

  const TEST_Z = { phase: "EXECUTE", title: "UC testa a flag Z", activeComponents: ["CONTROL_UNIT", "FLAGS"], control: ["CLOCK"], waitCycles: undefined };
  const TEST_N = { ...TEST_Z, title: "UC testa a flag N" };
  const LOAD_PC = { phase: "EXECUTE", activeComponents: ["CONTROL_UNIT", "IR", "PC"], control: ["CLOCK", "PC_LOAD"], waitCycles: undefined };

  it("JZ com Z = 1: testa a flag e desvia", () => {
    const { state, micros } = runSource("LDI R1, 1\nSUB R1, R1\nJZ pula\nLDI R3, 1\npula: HLT");
    const steps = executeMicros(micros, 2);
    expect(steps.map(shape)).toEqual([TEST_Z, { ...LOAD_PC, title: "PC ← 0x04" }]);
    expect(steps[0].explanation).toBe("Z = 1 (o último resultado da ULA foi zero): o desvio será tomado.");
    expect(state.registers[3]).toBe(0);
  });

  it("JZ com Z = 0: testa a flag e não desvia", () => {
    const { state, micros } = runSource("LDI R1, 1\nJZ pula\nLDI R3, 1\npula: HLT");
    const steps = executeMicros(micros, 1);
    expect(steps.map(shape)).toEqual([TEST_Z]);
    expect(steps[0].explanation).toBe("Z = 0: o desvio não é tomado e o PC continua em 0x02, a instrução seguinte.");
    expect(state.registers[3]).toBe(1);
  });

  it("JN com N = 1: testa a flag e desvia", () => {
    const { state, micros } = runSource(`${SETUP}SUB R2, R1\nJN pula\nLDI R3, 1\npula: HLT`);
    const steps = executeMicros(micros, 3);
    expect(steps.map(shape)).toEqual([TEST_N, { ...LOAD_PC, title: "PC ← 0x05" }]);
    expect(steps[0].explanation).toBe("N = 1 (o último resultado da ULA foi negativo): o desvio será tomado.");
    expect(state.registers[3]).toBe(0);
  });

  it("JN com N = 0: testa a flag e não desvia", () => {
    const { state, micros } = runSource(`${SETUP}SUB R1, R2\nJN pula\nLDI R3, 1\npula: HLT`);
    expect(executeMicros(micros, 3).map(shape)).toEqual([TEST_N]);
    expect(state.registers[3]).toBe(1);
  });

  it("HLT para a máquina", () => {
    const { state, micros } = runSource("HLT");
    expect(executeMicros(micros, 0).map(shape)).toEqual([
      { phase: "EXECUTE", title: "HLT: fim da execução", activeComponents: ["CONTROL_UNIT"], control: ["CLOCK", "HALT"], waitCycles: undefined },
    ]);
    expect(state).toMatchObject({ halted: true, phase: "HALT" });
    expect(state.error).toBeUndefined();
  });
});

describe("exceções didáticas", () => {
  it("opcode reservado na decodificação", () => {
    const { state, micros } = runSource(".word 0xD000");
    const last = micros[micros.length - 1];
    expect(shape(last)).toEqual({
      phase: "DECODE",
      title: "Exceção: instrução inválida",
      activeComponents: ["CONTROL_UNIT", "IR"],
      control: ["CLOCK", "HALT"],
      waitCycles: undefined,
    });
    expect(last.instruction).toBeUndefined();
    expect(last.explanation).toBe("Instrução inválida: o opcode 0xD é reservado. A UC interrompe a execução (exceção didática).");
    expect(state).toMatchObject({ halted: true, phase: "HALT", error: "Instrução inválida: o opcode 0xD é reservado." });
  });

  it("PC apontando para a região de E/S", () => {
    const { state, micros } = runSource("JMP 0xF5");
    expect(micros[micros.length - 1]).toMatchObject({
      phase: "FETCH",
      title: "Exceção: busca fora da área de programa",
      activeComponents: ["CONTROL_UNIT", "PC"],
      buses: { control: ["CLOCK", "HALT"] },
    });
    expect(state.error).toBe("O PC (0xF5) aponta para a região de E/S (0xF0–0xFF), onde não há instruções.");
  });

  it("programa que termina sem HLT e avança até a região de E/S", () => {
    const { state } = runSource("JMP ultimo\n.org 0xEF\nultimo: NOP");
    expect(state.pc).toBe(0xf0);
    expect(state.error).toContain("0xF0");
  });

  it("máquina parada explica o motivo e não muda o estado", () => {
    const { state } = runSource(".word 0xE000");
    const { state: after, micro } = step(state);
    expect(after).toEqual(state);
    expect(micro).toMatchObject({ phase: "HALT", title: "Máquina parada", cycle: state.cycle, changes: [], activeComponents: [] });
    expect(micro.explanation).toBe(
      "A execução foi interrompida: Instrução inválida: o opcode 0xE é reservado. Use Reset para recomeçar.",
    );
  });

  it("execução com IR inválido só acontece se o estado for forjado", () => {
    const forged = { ...createMachine([]), phase: "EXECUTE" as const, ir: 0xd000 };
    expect(() => step(forged)).toThrow(/reservado/);
  });
});
